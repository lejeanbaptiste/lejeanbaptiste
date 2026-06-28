import { readOrlandoHeaderPathValues } from './orlandoHeaderXml';
import type { ProjectMetadataFile } from './projectTypes';
import { isOrlandoCatalog } from './schemaMetadataFields';
import { readHeaderPathValues } from './teiHeaderXml';

export const getLastAppliedValue = (
  lastApplied: ProjectMetadataFile['lastApplied'],
  path: string,
): string | undefined => {
  if (!lastApplied) return undefined;
  if (lastApplied.fields[path] !== undefined) return lastApplied.fields[path];
  return lastApplied.custom.find((row) => row.path === path)?.value;
};

export const shouldSkipPathForFile = (
  currentValue: string,
  lastAppliedValue: string | undefined,
  newProjectValue: string,
): boolean => {
  if (lastAppliedValue === undefined) return false;

  const current = currentValue.trim();
  const last = lastAppliedValue.trim();
  const next = newProjectValue.trim();

  if (current === next) return false;
  if (current === last) return false;
  if (current === '') return false;

  return true;
};

export const buildLastAppliedSnapshot = (
  metadata: ProjectMetadataFile,
): NonNullable<ProjectMetadataFile['lastApplied']> => ({
  at: new Date().toISOString(),
  fields: { ...metadata.fields },
  custom: metadata.custom.map((row) => ({ path: row.path, value: row.value })),
});

export const filterEntriesForFile = (
  xml: string,
  entries: Array<{ path: string; value: string }>,
  lastApplied: ProjectMetadataFile['lastApplied'],
  catalogId?: string | null,
): { entries: Array<{ path: string; value: string }>; overridesSkipped: number } => {
  if (!lastApplied) {
    return { entries, overridesSkipped: 0 };
  }

  const paths = entries.map((entry) => entry.path);
  const currentValues = isOrlandoCatalog(catalogId)
    ? readOrlandoHeaderPathValues(xml, paths)
    : readHeaderPathValues(xml, paths);

  let overridesSkipped = 0;
  const filtered = entries.filter(({ path, value }) => {
    const current = currentValues[path] ?? '';
    const last = getLastAppliedValue(lastApplied, path);
    if (shouldSkipPathForFile(current, last, value)) {
      overridesSkipped += 1;
      return false;
    }
    return true;
  });

  return { entries: filtered, overridesSkipped };
};
