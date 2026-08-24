import type { EntityDataAssertion } from '../plugins/entityDataExtractors';
import { personWrapperSource } from './entityExtraction';
import type { EntityStore } from './entityStore';

export interface XmlExtractedRefreshStats {
  wrappers: number;
  added: number;
  removed: number;
  retained: number;
}

/** Minimal store surface used by SQLite extraction (easy to fake in unit tests). */
export type SqliteExtractionStore = Pick<EntityStore, 'sqliteReconcileXmlExtractedData'>;

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

function collectLiveWrappers(
  corpusDoc: Document,
  documentKey: string,
  extract: (wrapper: Element, documentKey: string) => EntityDataAssertion[],
): {
  entityId: string;
  source: string;
  assertions: EntityDataAssertion[];
}[] {
  const wrappers: {
    entityId: string;
    source: string;
    assertions: EntityDataAssertion[];
  }[] = [];
  for (const wrapper of Array.from(corpusDoc.getElementsByTagName('name'))) {
    if (wrapper.getAttribute('type') !== 'personWrapper') continue;
    const entityId = wrapperEntityId(wrapper);
    if (!entityId) continue;
    const occurrence = personWrapperOccurrence(wrapper);
    const source = personWrapperSource(documentKey, occurrence);
    wrappers.push({
      entityId,
      source,
      assertions: extract(wrapper, documentKey),
    });
  }
  return wrappers;
}

/**
 * SQLite twin of `refreshExtractedEntityDataForDocument`.
 * Writes origin=xml assertions into person_* tables; does not touch entities.xml.
 */
export async function refreshExtractedEntityDataForDocumentSqlite(
  store: SqliteExtractionStore,
  corpusDoc: Document,
  documentKey: string,
  extract: (wrapper: Element, documentKey: string) => EntityDataAssertion[],
): Promise<XmlExtractedRefreshStats> {
  const wrappers = collectLiveWrappers(corpusDoc, documentKey, extract);
  return store.sqliteReconcileXmlExtractedData({
    documentKey,
    wrappers,
    purgeOrphanSources: true,
  });
}

/**
 * SQLite twin of one-shot `ingestExtractedEntityData` (e.g. resolveMention).
 * Does not purge sibling wrappers in the same document.
 */
export async function ingestExtractedEntityDataSqlite(
  store: SqliteExtractionStore,
  documentKey: string,
  entityId: string,
  source: string,
  assertions: EntityDataAssertion[],
): Promise<XmlExtractedRefreshStats> {
  return store.sqliteReconcileXmlExtractedData({
    documentKey,
    wrappers: [{ entityId, source, assertions }],
    purgeOrphanSources: false,
  });
}

export { personWrapperSource };
