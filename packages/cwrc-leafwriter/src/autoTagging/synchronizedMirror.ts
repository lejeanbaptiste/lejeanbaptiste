import {
  ENTITY_KINDS,
  entityElements,
  entityKindOfElement,
  findEntity,
  getDatabaseId,
  touchEntity,
  type EntityKind,
} from './entities';
import { getCentralId, setCentralMapping } from './concordance';
import type { EntityStore } from './entityStore';
import { promoteToCentral } from './promote';

const CHECKPOINT_FILE = 'central-sync-checkpoint.json';
const CENTRAL_MAPPING_TYPE = 'ljb-central';

export interface SyncPairCheckpoint {
  centralId: string;
  pedbHash: string;
  centralHash: string;
}

export interface SynchronizedMirrorCheckpoint {
  version: 1;
  centralDatabaseId: string | null;
  pairs: Record<string, SyncPairCheckpoint>;
}

export interface SynchronizedMirrorConflict {
  pedbId: string;
  centralId: string;
  reason: 'both-sides-changed';
}

export interface SynchronizedMirrorResult {
  centralChanged: boolean;
  projectChanged: boolean;
  checkpointChanged: boolean;
  uploadedProjectChanges: number;
  downloadedCentralChanges: number;
  conflicts: SynchronizedMirrorConflict[];
  unavailable: boolean;
}

const emptyCheckpoint = (): SynchronizedMirrorCheckpoint => ({
  version: 1,
  centralDatabaseId: null,
  pairs: {},
});

const allEntityElements = (doc: Document): Element[] =>
  (Object.keys(ENTITY_KINDS) as EntityKind[]).flatMap((kind) => entityElements(doc, kind));

/** Remove local ids, concordance ids, and volatile timestamps before hashing content. */
function normalizedEntityXml(item: Element): string {
  const clone = item.cloneNode(true) as Element;
  const walker = clone.ownerDocument!.createTreeWalker(clone, 1);
  const elements: Element[] = [clone];
  let current: Node | null = walker.nextNode();
  while (current) {
    elements.push(current as Element);
    current = walker.nextNode();
  }
  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      if (
        attribute.name === 'xml:id' ||
        attribute.localName === 'id' ||
        (element === clone && attribute.name === 'id')
      ) {
        element.removeAttributeNode(attribute);
      }
    }
    for (const child of Array.from(element.children)) {
      if (
        child.localName === 'idno' && child.getAttribute('type') === CENTRAL_MAPPING_TYPE
      ) {
        child.remove();
      } else if (
        child.localName === 'note' && child.getAttribute('type') === 'ljb-changed'
      ) {
        child.remove();
      }
    }
  }
  return new XMLSerializer().serializeToString(clone);
}

function hash(value: string): string {
  // Small deterministic hash; this is a change detector, not a security hash.
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

export function entityContentHash(item: Element): string {
  return hash(normalizedEntityXml(item));
}

async function readCheckpoint(store: EntityStore): Promise<SynchronizedMirrorCheckpoint> {
  const raw = await store.readProjectLjbFile(CHECKPOINT_FILE);
  if (!raw) return emptyCheckpoint();
  try {
    const parsed = JSON.parse(raw) as SynchronizedMirrorCheckpoint;
    if (parsed.version !== 1 || !parsed.pairs || typeof parsed.pairs !== 'object') {
      return emptyCheckpoint();
    }
    return parsed;
  } catch {
    return emptyCheckpoint();
  }
}

async function writeCheckpoint(
  store: EntityStore,
  checkpoint: SynchronizedMirrorCheckpoint,
): Promise<void> {
  await store.writeProjectLjbFile(CHECKPOINT_FILE, `${JSON.stringify(checkpoint, null, 2)}\n`);
}

function mappedCentralId(item: Element, userStableId: string): string | null {
  return getCentralId(item, userStableId);
}

function copyEntityContent(source: Element, target: Element): boolean {
  const before = entityContentHash(target);
  const mapping = Array.from(target.children).find(
    (child) => child.localName === 'idno' && child.getAttribute('type') === CENTRAL_MAPPING_TYPE,
  );
  for (const child of Array.from(target.children)) child.remove();
  for (const child of Array.from(source.children)) {
    if (child.localName === 'idno' && child.getAttribute('type') === CENTRAL_MAPPING_TYPE) continue;
    if (child.localName === 'note' && child.getAttribute('type') === 'ljb-changed') continue;
    target.appendChild(target.ownerDocument!.importNode(child, true));
  }
  if (mapping) target.appendChild(mapping);
  touchEntity(target);
  return before !== entityContentHash(target);
}

function indexById(doc: Document): Map<string, Element> {
  return new Map(
    allEntityElements(doc)
      .map((item) => [item.getAttribute('xml:id'), item] as const)
      .filter((entry): entry is [string, Element] => Boolean(entry[0])),
  );
}

/**
 * Synchronize a project mirror against CEDB using the last checkpoint as the
 * common ancestor. CEDB wins only when PEDB is unchanged; an offline PEDB edit
 * is uploaded when CEDB is unchanged; simultaneous edits are reported.
 */
export async function synchronizeMirroredProject(
  projectStore: EntityStore,
  centralStore: EntityStore,
  userStableId: string,
): Promise<SynchronizedMirrorResult> {
  const result: SynchronizedMirrorResult = {
    centralChanged: false,
    projectChanged: false,
    checkpointChanged: false,
    uploadedProjectChanges: 0,
    downloadedCentralChanges: 0,
    conflicts: [],
    unavailable: false,
  };

  let pedbDoc: Document;
  let centralDoc: Document;
  try {
    [pedbDoc, centralDoc] = await Promise.all([
      projectStore.loadEntities(),
      centralStore.loadEntities(),
    ]);
  } catch {
    result.unavailable = true;
    return result;
  }

  const checkpoint = await readCheckpoint(projectStore);
  const pedbById = indexById(pedbDoc);
  let centralById = indexById(centralDoc);
  const createdCentralIds = new Set<string>();

  // Entities created locally while offline have no concordance yet. In a
  // synchronized project they are queued for the canonical database rather
  // than remaining project-only records.
  for (const pedbItem of [...pedbById.values()]) {
    if (mappedCentralId(pedbItem, userStableId)) continue;
    const pedbId = pedbItem.getAttribute('xml:id');
    if (!pedbId) continue;
    const promoted = promoteToCentral(pedbDoc, pedbId, centralDoc, userStableId);
    if (promoted.created) createdCentralIds.add(promoted.centralId);
    result.centralChanged = true;
  }
  centralById = indexById(centralDoc);

  const nextPairs: Record<string, SyncPairCheckpoint> = {};
  for (const pedbItem of allEntityElements(pedbDoc)) {
    const pedbId = pedbItem.getAttribute('xml:id');
    const centralId = mappedCentralId(pedbItem, userStableId);
    if (!pedbId || !centralId) continue;
    const centralItem = centralById.get(centralId);
    if (!centralItem || entityKindOfElement(centralItem) !== entityKindOfElement(pedbItem)) continue;

    const prior = checkpoint.pairs[pedbId];
    const pedbHash = entityContentHash(pedbItem);
    const centralHash = entityContentHash(centralItem);
    let chosen = centralItem;

    if (createdCentralIds.has(centralId)) {
      if (copyEntityContent(pedbItem, centralItem)) result.centralChanged = true;
      chosen = centralItem;
    } else if (prior && prior.centralId === centralId) {
      const pedbChanged = pedbHash !== prior.pedbHash;
      const centralChanged = centralHash !== prior.centralHash;
      if (pedbChanged && centralChanged && pedbHash !== centralHash) {
        result.conflicts.push({ pedbId, centralId, reason: 'both-sides-changed' });
        continue;
      }
      if (pedbChanged && !centralChanged) {
        if (copyEntityContent(pedbItem, centralItem)) result.centralChanged = true;
        result.uploadedProjectChanges += 1;
      } else if (!pedbChanged && centralChanged) {
        if (copyEntityContent(centralItem, pedbItem)) result.projectChanged = true;
        result.downloadedCentralChanges += 1;
      }
    } else if (pedbHash !== centralHash) {
      // First synchronized open establishes CEDB as canonical.
      if (copyEntityContent(centralItem, pedbItem)) result.projectChanged = true;
      result.downloadedCentralChanges += 1;
    }

    nextPairs[pedbId] = {
      centralId,
      pedbHash: entityContentHash(pedbItem),
      centralHash: entityContentHash(chosen),
    };
  }

  if (result.centralChanged) await centralStore.saveEntities(centralDoc);
  if (result.projectChanged) await projectStore.saveEntities(pedbDoc);

  const nextCheckpoint: SynchronizedMirrorCheckpoint = {
    version: 1,
    centralDatabaseId: getDatabaseId(centralDoc),
    pairs: nextPairs,
  };
  if (JSON.stringify(nextCheckpoint) !== JSON.stringify(checkpoint)) {
    await writeCheckpoint(projectStore, nextCheckpoint);
    result.checkpointChanged = true;
  }
  return result;
}

