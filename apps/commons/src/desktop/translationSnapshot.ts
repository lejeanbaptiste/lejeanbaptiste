import {
  ensureSchemaDirectory,
  getTranslationIndexAbsolutePath,
  readProjectFileIfExists,
  type ProjectBundle,
} from './projectFile';
import { getTranslatableUnits, hashUnitContent, normalizeUnitText } from './translationBootstrap';

const PREVIEW_LENGTH = 80;

export interface SnapshotUnit {
  id: string;
  contentHash: string;
  index: number;
  preview: string;
}

export interface TranslationIndexFile {
  version: 1;
  /** Keyed by source file name (not path — files can move within the project). */
  files: Record<string, SnapshotUnit[]>;
}

export const readTranslationSnapshot = async (
  bundle: ProjectBundle,
): Promise<TranslationIndexFile | null> => {
  const raw = await readProjectFileIfExists(getTranslationIndexAbsolutePath(bundle));
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as TranslationIndexFile;
    if (parsed.version !== 1 || typeof parsed.files !== 'object' || parsed.files === null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const buildSnapshotUnits = async (
  sourceDoc: Document,
  alignmentUnit: 'div' | 'p',
): Promise<SnapshotUnit[]> => {
  const units: SnapshotUnit[] = [];
  const elements = getTranslatableUnits(sourceDoc, alignmentUnit);

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    const id = element.getAttribute('xml:id');
    if (!id) continue;
    units.push({
      id,
      // eslint-disable-next-line no-await-in-loop
      contentHash: await hashUnitContent(element),
      index,
      preview: normalizeUnitText(element).slice(0, PREVIEW_LENGTH),
    });
  }

  return units;
};

/**
 * Records the known-good id/content-hash state of a source file's alignment units in
 * schema/translation-index.json. Called only after successful saves/bootstraps, so the
 * snapshot always reflects the last state in which translation links were verified.
 * Purely a recovery aid — the xml:id attributes in the TEI files remain the source of truth.
 */
export const writeTranslationSnapshot = async (
  bundle: ProjectBundle,
  sourceFileName: string,
  sourceDoc: Document,
  alignmentUnit: 'div' | 'p',
): Promise<void> => {
  if (!window.electronAPI?.writeFile) return;

  const units = await buildSnapshotUnits(sourceDoc, alignmentUnit);
  const existing = await readTranslationSnapshot(bundle);
  const next: TranslationIndexFile = {
    version: 1,
    files: { ...existing?.files, [sourceFileName]: units },
  };

  await ensureSchemaDirectory(bundle);

  await window.electronAPI.writeFile(
    getTranslationIndexAbsolutePath(bundle),
    JSON.stringify(next, null, 2),
  );
};
