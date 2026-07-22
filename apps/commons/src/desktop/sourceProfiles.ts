import type { SourceDescription } from './sourceDescription';
import { documentSupportsFileMetadata, isTeiCatalogForFileMetadata } from './fileMetadata';
import { readSourceDescriptionFromXml } from './sourceDescription';
import type {
  DedupedProjectSource,
  SharedSourceDescription,
  SourceProfile,
} from './sourceProfileTypes';

export const normalizeProfileTitle = (title: string): string =>
  title.normalize('NFC').trim().toLowerCase();

export const profileIdentityKey = (
  source: SourceDescription | SharedSourceDescription,
): string => {
  if (source.titleRef?.trim()) return `ref:${source.titleRef.trim()}`;
  if (source.titleKey?.trim()) return `key:${source.titleKey.trim()}`;
  const normalized = normalizeProfileTitle(source.title);
  return normalized ? `title:${normalized}` : 'title:';
};

export const profileLabelFromSource = (source: SharedSourceDescription): string => {
  const title = source.title.trim();
  return title || 'Untitled source';
};

export const toSharedSource = (source: SourceDescription): SharedSourceDescription => ({
  title: source.title,
  titleRef: source.titleRef,
  titleKey: source.titleKey,
  authors: source.authors.map((author) => ({ ...author })),
  workDate: { ...source.workDate },
  edition: source.edition,
  editionDate: source.editionDate,
});

export const applyProfileToSource = (
  current: SourceDescription,
  profile: SharedSourceDescription,
): SourceDescription => ({
  ...profile,
  authors: profile.authors.map((author) => ({ ...author })),
  workDate: { ...profile.workDate },
  sourceNote: current.sourceNote,
});

export const sharedSourcesEqual = (
  left: SharedSourceDescription,
  right: SharedSourceDescription,
): boolean => JSON.stringify(left) === JSON.stringify(right);

export const dedupeProjectSources = (
  entries: Array<{ source: SourceDescription; filePath: string }>,
): DedupedProjectSource[] => {
  const groups = new Map<
    string,
    { label: string; source: SharedSourceDescription; fileCount: number; samplePath: string }
  >();

  for (const entry of entries) {
    const shared = toSharedSource(entry.source);
    if (!shared.title.trim() && shared.authors.length === 0) continue;

    const identityKey = profileIdentityKey(shared);
    const existing = groups.get(identityKey);
    if (existing) {
      existing.fileCount += 1;
      continue;
    }

    groups.set(identityKey, {
      label: profileLabelFromSource(shared),
      source: shared,
      fileCount: 1,
      samplePath: entry.filePath,
    });
  }

  return Array.from(groups.entries())
    .map(([identityKey, group]) => ({
      identityKey,
      label: group.label,
      source: group.source,
      fileCount: group.fileCount,
      samplePath: group.samplePath,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
};

export const scanProjectSourceProfiles = async (
  rootPath: string,
  catalogId?: string | null,
): Promise<DedupedProjectSource[]> => {
  if (!window.electronAPI?.listProjectXmlFiles || !window.electronAPI.readFile) {
    throw new Error('Desktop file APIs unavailable');
  }
  if (!isTeiCatalogForFileMetadata(catalogId)) {
    return [];
  }

  const files = await window.electronAPI.listProjectXmlFiles(rootPath);
  const entries: Array<{ source: SourceDescription; filePath: string }> = [];

  for (const file of files) {
    try {
      const xml = await window.electronAPI.readFile(file.path);
      if (!documentSupportsFileMetadata(xml, catalogId)) continue;
      const source = readSourceDescriptionFromXml(xml);
      entries.push({ source, filePath: file.path });
    } catch {
      // skip unreadable files
    }
  }

  return dedupeProjectSources(entries);
};

export const createSourceProfile = (
  source: SourceDescription | SharedSourceDescription,
  label?: string,
  existingProfiles: SourceProfile[] = [],
): SourceProfile => {
  const shared = 'sourceNote' in source ? toSharedSource(source) : source;
  const identityKey = profileIdentityKey(shared);
  const existing = existingProfiles.find((profile) => profile.identityKey === identityKey);
  return {
    id: existing?.id ?? crypto.randomUUID(),
    label: label?.trim() || profileLabelFromSource(shared),
    identityKey,
    source: shared,
    updatedAt: new Date().toISOString(),
  };
};

export const readGlobalSourceProfiles = async (): Promise<SourceProfile[]> => {
  const file = await window.electronAPI?.readSourceProfiles?.();
  return file?.profiles ?? [];
};

export const upsertGlobalSourceProfile = async (profile: SourceProfile): Promise<SourceProfile[]> => {
  if (!window.electronAPI?.upsertSourceProfile) {
    throw new Error('Desktop source profile APIs unavailable');
  }
  const file = await window.electronAPI.upsertSourceProfile(profile);
  return file.profiles;
};

export const deleteGlobalSourceProfile = async (profileId: string): Promise<SourceProfile[]> => {
  if (!window.electronAPI?.deleteSourceProfile) {
    throw new Error('Desktop source profile APIs unavailable');
  }
  const file = await window.electronAPI.deleteSourceProfile(profileId);
  return file.profiles;
};
