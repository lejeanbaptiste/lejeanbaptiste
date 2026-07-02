import { getActiveProjectBundle } from './activeProjectBundle';
import { getTranslatableUnits, hashUnitContent } from './translationBootstrap';
import { isTranslationFile } from './translationFileNaming';
import { readTranslationSettings } from './translationSettings';
import { readTranslationSnapshot, type SnapshotUnit } from './translationSnapshot';

const log = (...args: unknown[]) => console.log('[translation-recovery]', ...args);

const fileNameOf = (filePath: string): string => {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx === -1 ? filePath : filePath.slice(idx + 1);
};

const collectAllIds = (doc: Document): Set<string> => {
  const ids = new Set<string>();
  for (const element of Array.from(doc.getElementsByTagName('*'))) {
    const id = element.getAttribute('xml:id');
    if (id) ids.add(id);
  }
  return ids;
};

export interface RecoveryResult {
  xml: string;
  restored: number;
}

/**
 * Tier-1 translation-link recovery: after an external tool stripped or scrambled
 * alignment-unit xml:ids, restore ids from the last known-good snapshot by exact content
 * hash — but only where the hash is unique on BOTH sides (unique among the document's
 * units and unique in the snapshot), so identical paragraphs ("Amen.", empty units) are
 * never guessed at. Units the snapshot still recognizes by id are left untouched, as are
 * edited paragraphs (their hash no longer matches); those get fresh hash ids at the next
 * reindex-on-save. Returns null when nothing could be restored.
 */
export const recoverIdsFromSnapshot = async (
  sourceXml: string,
  snapshotUnits: SnapshotUnit[],
  alignmentUnit: 'div' | 'p',
): Promise<RecoveryResult | null> => {
  const doc = new DOMParser().parseFromString(sourceXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror')[0]) return null;

  const units = getTranslatableUnits(doc, alignmentUnit);
  const unitHashes = await Promise.all(units.map((unit) => hashUnitContent(unit)));

  const docHashCounts = new Map<string, number>();
  for (const hash of unitHashes) {
    docHashCounts.set(hash, (docHashCounts.get(hash) ?? 0) + 1);
  }

  const snapshotByHash = new Map<string, SnapshotUnit | null>();
  for (const entry of snapshotUnits) {
    snapshotByHash.set(entry.contentHash, snapshotByHash.has(entry.contentHash) ? null : entry);
  }

  const knownIds = new Set(snapshotUnits.map((entry) => entry.id));
  const takenIds = collectAllIds(doc);
  let restored = 0;

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i];
    const currentId = unit.getAttribute('xml:id');
    if (currentId && knownIds.has(currentId)) continue;

    const hash = unitHashes[i];
    if (docHashCounts.get(hash) !== 1) continue;

    const entry = snapshotByHash.get(hash);
    if (!entry || takenIds.has(entry.id)) continue;

    unit.setAttribute('xml:id', entry.id);
    takenIds.add(entry.id);
    restored += 1;
  }

  if (restored === 0) return null;

  return { xml: new XMLSerializer().serializeToString(doc), restored };
};

const suppressWatcherFor = async (filePath: string) => {
  if (!window.electronAPI?.statFile || !window.electronAPI?.ignoreFileChange) return;
  try {
    const { mtimeMs } = await window.electronAPI.statFile(filePath);
    await window.electronAPI.ignoreFileChange(filePath, mtimeMs);
  } catch {
    // ignore
  }
};

/**
 * Runs tier-1 recovery for an externally changed source file, writing the repaired file
 * back to disk (with watcher suppression) so the subsequent reload prompt already sees the
 * restored ids. Returns the number of restored links (0 when not applicable).
 */
export const recoverTranslationLinksOnExternalChange = async (
  filePath: string,
): Promise<number> => {
  if (isTranslationFile(filePath) || !filePath.toLowerCase().endsWith('.xml')) return 0;

  const bundle = getActiveProjectBundle();
  if (!bundle) return 0;

  const settings = await readTranslationSettings(bundle);
  if (!settings || settings.languages.length === 0) return 0;

  const snapshot = await readTranslationSnapshot(bundle);
  const snapshotUnits = snapshot?.files[fileNameOf(filePath)];
  if (!snapshotUnits || snapshotUnits.length === 0) return 0;

  let xml: string;
  try {
    xml = await window.electronAPI!.readFile(filePath);
  } catch {
    return 0;
  }

  const result = await recoverIdsFromSnapshot(xml, snapshotUnits, settings.alignmentUnit);
  if (!result) return 0;

  log('restored translation links after external change', {
    filePath,
    restored: result.restored,
  });
  await window.electronAPI!.writeFile(filePath, result.xml);
  await suppressWatcherFor(filePath);
  window.dispatchEvent(new CustomEvent('desktop:translation-reindexed'));

  return result.restored;
};
