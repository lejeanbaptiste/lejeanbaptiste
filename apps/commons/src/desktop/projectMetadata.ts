import {
  getMetadataAbsolutePath,
  getMetadataRelativePath,
  joinProjectPath,
  type ProjectBundle,
} from './projectFile';
import {
  BULK_APPLY_EXCLUDED_PATHS,
  getAllManagedPaths,
  isOrlandoCatalog,
  type MetadataFieldDefinition,
} from './schemaMetadataFields';
import type { ProjectMetadataFile } from './projectTypes';
import {
  buildLastAppliedSnapshot,
  filterEntriesForFile,
} from './metadataApplyOverrides';
import { applyOrlandoHeaderPathUpdates } from './orlandoHeaderXml';
import { applyHeaderPathUpdates } from './teiHeaderXml';

const emptyMetadata = (catalogId?: string): ProjectMetadataFile => ({
  version: 1,
  catalogId,
  fields: {},
  custom: [],
});

export const readProjectMetadata = async (
  bundle: ProjectBundle,
): Promise<ProjectMetadataFile | null> => {
  if (!window.electronAPI?.readFile) return null;
  const filePath = getMetadataAbsolutePath(bundle);

  try {
    const raw = await window.electronAPI.readFile(filePath);
    const parsed = JSON.parse(raw) as ProjectMetadataFile;
    return {
      version: 1,
      catalogId: parsed.catalogId,
      fields: parsed.fields ?? {},
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      lastApplied: parsed.lastApplied,
    };
  } catch {
    return null;
  }
};

export const metadataFileExists = async (bundle: ProjectBundle): Promise<boolean> => {
  if (!window.electronAPI?.readFile) return false;
  try {
    await window.electronAPI.readFile(getMetadataAbsolutePath(bundle));
    return true;
  } catch {
    return false;
  }
};

export const sanitizeMetadataForSave = (
  draft: ProjectMetadataFile,
): ProjectMetadataFile => {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(draft.fields ?? {})) {
    const trimmed = value?.trim();
    if (trimmed) fields[key] = trimmed;
  }

  const custom = (draft.custom ?? [])
    .map((row) => ({
      path: row.path?.trim() ?? '',
      label: row.label?.trim() || row.path?.trim() || 'Custom field',
      value: row.value?.trim() ?? '',
    }))
    .filter((row) => row.path);

  return {
    version: 1,
    catalogId: draft.catalogId,
    fields,
    custom,
    lastApplied: draft.lastApplied,
  };
};

export const writeProjectMetadata = async (
  bundle: ProjectBundle,
  draft: ProjectMetadataFile,
): Promise<void> => {
  if (!window.electronAPI?.writeFile) {
    throw new Error('File write unavailable');
  }

  const sanitized = sanitizeMetadataForSave(draft);
  const filePath = getMetadataAbsolutePath(bundle);
  const schemaDir = joinProjectPath(bundle.rootPath, 'schema');

  if (window.electronAPI.createDirectory) {
    try {
      await window.electronAPI.createDirectory(bundle.rootPath, 'schema');
    } catch {
      // may already exist
    }
  }

  await window.electronAPI.writeFile(filePath, JSON.stringify(sanitized, null, 2));

  if (!bundle.config.metadata) {
    bundle.config.metadata = getMetadataRelativePath(bundle.config);
  }
};

export const createInitialMetadata = (
  bundle: ProjectBundle,
  encoderName?: string,
): ProjectMetadataFile => {
  const base = emptyMetadata(bundle.config.schema?.catalogId);
  if (encoderName?.trim()) {
    if (isOrlandoCatalog(bundle.config.schema?.catalogId)) {
      base.fields['REVISIONDESC/RESPONSIBILITY'] = encoderName.trim();
    } else if (bundle.config.schema?.catalogId === 'teiSimplePrint') {
      base.fields['publicationStmt/distributor'] = encoderName.trim();
    } else if (bundle.config.schema?.catalogId !== 'jTei') {
      base.fields['titleStmt/principal'] = encoderName.trim();
    }
  }
  return base;
};

const applyMetadataToXml = (
  xml: string,
  entries: Array<{ path: string; value: string }>,
  options: { clearRemovedPaths?: string[]; catalogId?: string | null },
): string => {
  const updates = entries
    .filter(({ path, value }) => !BULK_APPLY_EXCLUDED_PATHS.has(path) && value.trim())
    .map(({ path, value }) => ({ path, value }));

  const clearPaths = (options.clearRemovedPaths ?? []).filter(
    (path) => !BULK_APPLY_EXCLUDED_PATHS.has(path),
  );

  if (isOrlandoCatalog(options.catalogId)) {
    return applyOrlandoHeaderPathUpdates(xml, updates, {
      clearPaths,
      skipPaths: BULK_APPLY_EXCLUDED_PATHS,
    });
  }

  return applyHeaderPathUpdates(xml, updates, {
    clearPaths,
    skipPaths: BULK_APPLY_EXCLUDED_PATHS,
  });
};

export interface ApplyMetadataResult {
  updated: number;
  skipped: number;
  overridesSkipped: number;
  errors: string[];
}

export const applyMetadataToProjectFiles = async (
  bundle: ProjectBundle,
  metadata: ProjectMetadataFile,
  options: { clearRemovedFromFiles?: boolean; previous?: ProjectMetadataFile | null },
): Promise<ApplyMetadataResult> => {
  if (!window.electronAPI?.listProjectXmlFiles || !window.electronAPI.readFile) {
    throw new Error('Desktop file APIs unavailable');
  }

  const entries: Array<{ path: string; value: string }> = [];

  for (const [path, value] of Object.entries(metadata.fields)) {
    entries.push({ path, value });
  }
  for (const row of metadata.custom) {
    entries.push({ path: row.path, value: row.value });
  }

  const clearRemovedPaths: string[] = [];
  if (options.clearRemovedFromFiles && options.previous) {
    const prevPaths = new Set([
      ...Object.keys(options.previous.fields ?? {}),
      ...(options.previous.custom ?? []).map((row) => row.path),
    ]);
    const nextPaths = new Set(entries.map((entry) => entry.path));
    for (const path of prevPaths) {
      if (!nextPaths.has(path)) clearRemovedPaths.push(path);
    }
  }

  const files = await window.electronAPI.listProjectXmlFiles(bundle.rootPath);
  let updated = 0;
  let skipped = 0;
  let overridesSkipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      const original = await window.electronAPI.readFile(file.path);
      const { entries: fileEntries, overridesSkipped: fileOverrides } = filterEntriesForFile(
        original,
        entries,
        metadata.lastApplied,
        metadata.catalogId,
      );
      overridesSkipped += fileOverrides;

      const next = applyMetadataToXml(original, fileEntries, {
        clearRemovedPaths,
        catalogId: metadata.catalogId,
      });
      if (next === original) {
        skipped += 1;
        continue;
      }
      await window.electronAPI.writeFile(file.path, next);
      updated += 1;
    } catch (error) {
      skipped += 1;
      errors.push(
        `${file.name}: ${error instanceof Error ? error.message : 'Failed to update'}`,
      );
    }
  }

  return { updated, skipped, overridesSkipped, errors };
};

export const mergeMetadataIntoSkeleton = (
  skeletonXml: string,
  metadata: ProjectMetadataFile,
): string => {
  const entries: Array<{ path: string; value: string }> = [];
  for (const [path, value] of Object.entries(metadata.fields ?? {})) {
    if (value.trim()) entries.push({ path, value });
  }
  for (const row of metadata.custom ?? []) {
    if (row.path.trim() && row.value.trim()) {
      entries.push({ path: row.path, value: row.value });
    }
  }
  if (entries.length === 0) return skeletonXml;
  return applyMetadataToXml(skeletonXml, entries, { catalogId: metadata.catalogId });
};

/** @deprecated Use mergeMetadataIntoSkeleton */
export const mergeMetadataIntoHeader = mergeMetadataIntoSkeleton;

export const metadataEntriesFromFile = (metadata: ProjectMetadataFile) => {
  const entries: Array<{ path: string; value: string; label: string }> = [];
  for (const [path, value] of Object.entries(metadata.fields)) {
    entries.push({ path, value, label: path });
  }
  for (const row of metadata.custom) {
    entries.push({ path: row.path, value: row.value, label: row.label });
  }
  return entries;
};

export const getManagedFieldValues = (
  metadata: ProjectMetadataFile | null,
  fieldDefinitions: MetadataFieldDefinition[],
): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const field of fieldDefinitions) {
    values[field.path] = metadata?.fields?.[field.path] ?? '';
  }
  return values;
};

export { buildLastAppliedSnapshot, getAllManagedPaths, emptyMetadata };
