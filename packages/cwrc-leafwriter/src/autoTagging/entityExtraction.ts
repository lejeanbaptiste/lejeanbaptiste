import { findEntity, touchEntity } from './entities';
import {
  entityValueKey,
  readEntityValueProvenance,
  writeEntityValueProvenance,
} from './entityProvenance';
import type { EntityDataAssertion } from '../plugins/entityDataExtractors';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

export function personWrapperSource(documentKey: string, occurrence: number): string {
  return `xml:${documentKey}#personWrapper:${occurrence}`;
}

function wrapperEntityId(wrapper: Element): string | null {
  const own = wrapper.getAttribute('key')?.trim();
  if (own) return own;
  const person = Array.from(wrapper.getElementsByTagName('persName')).find((candidate) =>
    candidate.getAttribute('key'),
  );
  return person?.getAttribute('key')?.trim() || null;
}

function personWrapperOccurrence(wrapper: Element): number {
  const document = wrapper.ownerDocument;
  return (
    Array.from(document.getElementsByTagName('name'))
      .filter((candidate) => candidate.getAttribute('type') === 'personWrapper')
      .indexOf(wrapper) + 1
  );
}

/**
 * Ingest one current XML wrapper and reconcile its extracted assertions.
 * `source` must identify the wrapper, normally `xml:<document>#<xml:id>`.
 */
export function ingestExtractedEntityData(
  doc: Document,
  entityId: string,
  source: string,
  assertions: EntityDataAssertion[],
): { added: number; removed: number; retained: number } {
  const entity = findEntity(doc, entityId);
  if (!entity) throw new Error(`Entity not found: ${entityId}`);
  const currentKeys = new Set(
    assertions.map((assertion) =>
      [assertion.element, source, assertion.value.trim()].join('\u001f'),
    ),
  );
  let added = 0;
  let removed = 0;
  let retained = 0;

  for (const child of Array.from(entity.children)) {
    const provenance = readEntityValueProvenance(child);
    if (provenance.origin !== 'xml' || provenance.source !== source) continue;
    if (provenance.status !== 'active') {
      retained += 1;
      continue;
    }
    if (!currentKeys.has(entityValueKey(child))) {
      child.remove();
      removed += 1;
    } else retained += 1;
  }

  for (const assertion of assertions) {
    const key = [assertion.element, source, assertion.value.trim()].join('\u001f');
    const exists = Array.from(entity.children).some((child) => entityValueKey(child) === key);
    if (exists) continue;
    const element = doc.createElementNS(TEI_NS, assertion.element);
    element.textContent = assertion.value.trim();
    if (assertion.ref) element.setAttribute('ref', assertion.ref);
    writeEntityValueProvenance(element, { origin: 'xml', source });
    for (const nested of assertion.children ?? []) {
      const child = doc.createElementNS(TEI_NS, nested.element);
      child.textContent = nested.value;
      if (nested.ref) child.setAttribute('ref', nested.ref);
      element.appendChild(child);
    }
    entity.appendChild(element);
    added += 1;
  }
  if (added || removed) touchEntity(entity);
  return { added, removed, retained };
}

/** Refresh all resolved person wrappers in one corpus document. */
export function refreshExtractedEntityDataForDocument(
  entitiesDoc: Document,
  corpusDoc: Document,
  documentKey: string,
  extract: (wrapper: Element, documentKey: string) => EntityDataAssertion[],
): { wrappers: number; added: number; removed: number; retained: number } {
  const liveSources = new Set<string>();
  let wrappers = 0;
  let added = 0;
  let removed = 0;
  let retained = 0;
  for (const wrapper of Array.from(corpusDoc.getElementsByTagName('name'))) {
    if (wrapper.getAttribute('type') !== 'personWrapper') continue;
    const entityId = wrapperEntityId(wrapper);
    if (!entityId) continue;
    const occurrence = personWrapperOccurrence(wrapper);
    const source = personWrapperSource(documentKey, occurrence);
    liveSources.add(source);
    const result = ingestExtractedEntityData(
      entitiesDoc,
      entityId,
      source,
      extract(wrapper, documentKey),
    );
    wrappers += 1;
    added += result.added;
    removed += result.removed;
    retained += result.retained;
  }

  // A wrapper may have been removed or unwrapped since the previous scan.
  // Remove only still-refreshable XML assertions; validated values are user data.
  const entityElements = Array.from(entitiesDoc.getElementsByTagName('*')).filter((element) =>
    element.hasAttribute('xml:id'),
  );
  for (const entity of entityElements) {
    for (const child of Array.from(entity.children)) {
      const source = child.getAttribute('source');
      if (!source?.startsWith(`xml:${documentKey}#personWrapper:`) || liveSources.has(source))
        continue;
      if (
        child.getAttribute('origin') === 'xml' &&
        (child.getAttribute('status') ?? 'active') === 'active'
      ) {
        child.remove();
        removed += 1;
        touchEntity(entity);
      }
    }
  }
  return { wrappers, added, removed, retained };
}
