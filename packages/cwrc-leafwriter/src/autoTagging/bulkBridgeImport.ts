import { ENTITY_KINDS, entityElements, entityKindOfElement, type EntityKind } from './entities';
import { getCentralId, setCentralMapping } from './concordance';
import { applyReconcilePlan, planReconcile } from './reconcile';

/** Every entity element in the document, across all kinds. */
const allEntityElements = (doc: Document): Element[] =>
  (Object.keys(ENTITY_KINDS) as EntityKind[]).flatMap((kind) => entityElements(doc, kind));

/** A deliberately small progress contract: callers can render this in a modal or log it. */
export interface BulkBridgeProgress {
  stage: 'indexing' | 'matching' | 'merging' | 'complete';
  done: number;
  total: number;
  matched: number;
  proposed: number;
  ambiguous: number;
  merged: number;
  lastSourceId: string | null;
}

export interface BulkBridgeProposal {
  sourceId: string;
  kind: EntityKind;
  name: string | null;
  authorities: { type: string; value: string }[];
  reason: 'no-authority-match' | 'ambiguous-authority-match';
  candidateCentralIds: string[];
}

export interface BulkBridgeResult {
  matched: number;
  proposed: number;
  ambiguous: number;
  merged: number;
  sourceChanged: boolean;
  centralChanged: boolean;
  proposals: BulkBridgeProposal[];
}

export interface BulkBridgeOptions {
  sourceDoc: Document;
  centralDoc: Document;
  userStableId: string;
  chunkSize?: number;
  /** Persist after this many merged source rows; defaults to ten chunks. */
  checkpointInterval?: number;
  onCheckpoint?: (progress: BulkBridgeProgress) => Promise<void> | void;
  onProgress?: (progress: BulkBridgeProgress) => void;
  /** Called as soon as a proposal is found, so callers need not retain all proposals. */
  onProposal?: (proposal: BulkBridgeProposal) => void;
  /** Cooperative cancellation. The current chunk is finished, then the import stops. */
  shouldCancel?: () => boolean;
}

const key = (kind: EntityKind, type: string, value: string) =>
  `${kind}\t${type.trim().toLowerCase()}\t${value.trim()}`;

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const nameOf = (item: Element): string | null =>
  Array.from(item.children)
    .find((child) => /Name$/.test(child.localName ?? ''))
    ?.textContent?.trim() || null;

const authoritiesOf = (item: Element) =>
  Array.from(item.children)
    .filter((child) => child.localName === 'idno' && child.getAttribute('type') !== 'grognard-central')
    .map((child) => ({
      type: child.getAttribute('type')?.trim() ?? '',
      value: child.textContent?.trim() ?? '',
    }))
    .filter((authority) => authority.type && authority.value);

const repeatableChildKey = (child: Element): string => {
  const attrs = Array.from(child.attributes)
    .filter((attr) => attr.name !== 'changed')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((attr) => `${attr.name}=${attr.value}`)
    .join('&');
  return `${child.localName}\t${attrs}\t${child.textContent?.trim() ?? ''}`;
};

/** Copy source assertions which the normal scalar reconciler intentionally does not model. */
const mergeRepeatableChildren = (source: Element, central: Element): boolean => {
  const ignored = new Set([
    'persName',
    'placeName',
    'orgName',
    'title',
    'idno',
    'birth',
    'death',
    'note', // descriptions, names, dates and changed stamps are handled by reconcile
  ]);
  const existing = new Set(
    Array.from(central.children)
      .filter((child) => !ignored.has(child.localName ?? ''))
      .map(repeatableChildKey),
  );
  let changed = false;
  for (const child of Array.from(source.children)) {
    if (ignored.has(child.localName ?? '')) continue;
    const cloned = central.ownerDocument.importNode(child, true);
    const childKey = repeatableChildKey(cloned);
    if (existing.has(childKey)) continue;
    central.appendChild(cloned);
    existing.add(childKey);
    changed = true;
  }
  return changed;
};

/**
 * Import one project entity database into the central database.
 *
 * The expensive work is deliberately split into short chunks. Authority indexes
 * are built once, exact matches are decided before mutation, and unmatched or
 * ambiguous rows remain proposals instead of being silently added as duplicates.
 */
export async function bulkBridgeImport(options: BulkBridgeOptions): Promise<BulkBridgeResult> {
  const chunkSize = Math.max(25, options.chunkSize ?? 250);
  const centralByAuthority = new Map<string, string[]>();
  const centralItems = new Map<string, Element>();
  const sourceItems = allEntityElements(options.sourceDoc);
  const centralEntities = allEntityElements(options.centralDoc);
  // Built once so `applyReconcilePlan` never re-scans either document by id
  // while merging — a per-entity `findEntity` full-document scan here would
  // make the merge loop O(n²) for a large database.
  const sourceIndex = new Map<string, Element>();
  for (const item of sourceItems) {
    const id = item.getAttribute('xml:id');
    if (id) sourceIndex.set(id, item);
  }
  const centralIndex = new Map<string, Element>();
  for (const item of centralEntities) {
    const id = item.getAttribute('xml:id');
    if (id) centralIndex.set(id, item);
  }

  const progress = (update: Partial<BulkBridgeProgress>) =>
    options.onProgress?.({
      stage: 'indexing',
      done: 0,
      total: sourceItems.length,
      matched: 0,
      proposed: 0,
      ambiguous: 0,
      merged: 0,
      lastSourceId: null,
      ...update,
    });

  for (let offset = 0; offset < centralEntities.length; offset += chunkSize) {
    for (const item of centralEntities.slice(offset, offset + chunkSize)) {
      const kind = entityKindOfElement(item);
      const id = item.getAttribute('xml:id');
      if (!kind || !id) continue;
      centralItems.set(`${kind}\t${id}`, item);
      for (const authority of authoritiesOf(item)) {
        const authorityKey = key(kind, authority.type, authority.value);
        const ids = centralByAuthority.get(authorityKey) ?? [];
        if (!ids.includes(id)) ids.push(id);
        centralByAuthority.set(authorityKey, ids);
      }
    }
    progress({
      done: Math.min(offset + chunkSize, centralEntities.length),
      total: centralEntities.length,
      lastSourceId: null,
    });
    await yieldToUi();
  }

  const decisions = new Map<string, string>();
  const proposals: BulkBridgeProposal[] = [];
  let proposed = 0;
  let ambiguous = 0;
  for (let offset = 0; offset < sourceItems.length; offset += chunkSize) {
    for (const source of sourceItems.slice(offset, offset + chunkSize)) {
      const kind = entityKindOfElement(source);
      const sourceId = source.getAttribute('xml:id');
      if (!kind || !sourceId) continue;
      const candidates = new Set<string>();
      for (const authority of authoritiesOf(source)) {
        for (const id of centralByAuthority.get(key(kind, authority.type, authority.value)) ?? []) {
          candidates.add(id);
        }
      }
      // Existing concordance is useful when the source authority has since been removed.
      const mapped = getCentralId(source, options.userStableId);
      if (mapped && centralItems.has(`${kind}\t${mapped}`)) candidates.add(mapped);
      const candidateIds = [...candidates];
      if (candidateIds.length === 1) decisions.set(sourceId, candidateIds[0]!);
      else {
        const proposal: BulkBridgeProposal = {
          sourceId,
          kind,
          name: nameOf(source),
          authorities: authoritiesOf(source),
          reason: candidateIds.length ? 'ambiguous-authority-match' : 'no-authority-match',
          candidateCentralIds: candidateIds,
        };
        proposals.push(proposal);
        options.onProposal?.(proposal);
        if (candidateIds.length) ambiguous += 1;
        else proposed += 1;
      }
    }
    progress({
      stage: 'matching',
      done: Math.min(offset + chunkSize, sourceItems.length),
      matched: decisions.size,
      proposed,
      ambiguous,
    });
    await yieldToUi();
    if (options.shouldCancel?.())
      return {
        matched: decisions.size,
        proposed,
        ambiguous,
        merged: 0,
        sourceChanged: false,
        centralChanged: false,
        proposals,
      };
  }

  let sourceChanged = false;
  let centralChanged = false;
  let merged = 0;
  let done = 0;
  const checkpointInterval = Math.max(chunkSize, options.checkpointInterval ?? chunkSize * 10);
  for (let offset = 0; offset < sourceItems.length; offset += chunkSize) {
    for (const source of sourceItems.slice(offset, offset + chunkSize)) {
      const sourceId = source.getAttribute('xml:id');
      const centralId = sourceId ? decisions.get(sourceId) : undefined;
      if (!sourceId || !centralId) {
        done += 1;
        continue;
      }
      const kind = entityKindOfElement(source);
      const central = kind ? centralItems.get(`${kind}\t${centralId}`) : undefined;
      if (!central) {
        done += 1;
        continue;
      }
      const plan = planReconcile(source, central);
      const applied = applyReconcilePlan(
        options.sourceDoc,
        sourceId,
        options.centralDoc,
        centralId,
        plan,
        sourceIndex,
        centralIndex,
      );
      const richChanged = mergeRepeatableChildren(source, central);
      const mappingChanged = setCentralMapping(source, options.userStableId, centralId);
      sourceChanged ||= applied.pedbChanged || mappingChanged;
      centralChanged ||= applied.cedbChanged || richChanged;
      if (applied.pedbChanged || applied.cedbChanged || richChanged) merged += 1;
      done += 1;
    }
    progress({
      stage: 'merging',
      done,
      total: sourceItems.length,
      matched: decisions.size,
      proposed,
      ambiguous,
      merged,
      lastSourceId:
        sourceItems[Math.min(done - 1, sourceItems.length - 1)]?.getAttribute('xml:id') ?? null,
    });
    if (done > 0 && (done % checkpointInterval < chunkSize || done === sourceItems.length)) {
      await options.onCheckpoint?.({
        stage: 'merging',
        done,
        total: sourceItems.length,
        matched: decisions.size,
        proposed,
        ambiguous,
        merged,
        lastSourceId:
          sourceItems[Math.min(done - 1, sourceItems.length - 1)]?.getAttribute('xml:id') ?? null,
      });
    }
    await yieldToUi();
    if (options.shouldCancel?.()) break;
  }
  progress({
    stage: 'complete',
    done,
    total: sourceItems.length,
    matched: decisions.size,
    proposed,
    ambiguous,
    merged,
    lastSourceId: null,
  });
  return {
    matched: decisions.size,
    proposed,
    ambiguous,
    merged,
    sourceChanged,
    centralChanged,
    proposals,
  };
}
