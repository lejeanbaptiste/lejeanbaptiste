import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { SourceProfile, SourceProfileFile } from '../../commons/src/desktop/sourceProfileTypes';

const PROFILES_FILENAME = 'source-profiles.json';

const getProfilesPath = () => path.join(app.getPath('userData'), PROFILES_FILENAME);

const emptyFile = (): SourceProfileFile => ({ version: 1, profiles: [] });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeSharedSource = (value: unknown): SourceProfile['source'] | null => {
  if (!isRecord(value)) return null;
  const title = typeof value.title === 'string' ? value.title : '';
  const authors = Array.isArray(value.authors)
    ? value.authors
        .map((author) => {
          if (!isRecord(author)) return null;
          const name = typeof author.name === 'string' ? author.name.trim() : '';
          if (!name) return null;
          return {
            name,
            ref: typeof author.ref === 'string' ? author.ref : undefined,
            key: typeof author.key === 'string' ? author.key : undefined,
          };
        })
        .filter((author): author is NonNullable<typeof author> => Boolean(author))
    : [];

  const workDateRaw = isRecord(value.workDate) ? value.workDate : {};
  const workDate = {
    when: typeof workDateRaw.when === 'string' ? workDateRaw.when : undefined,
    notBefore: typeof workDateRaw.notBefore === 'string' ? workDateRaw.notBefore : undefined,
    notAfter: typeof workDateRaw.notAfter === 'string' ? workDateRaw.notAfter : undefined,
  };

  return {
    title,
    titleRef: typeof value.titleRef === 'string' ? value.titleRef : undefined,
    titleKey: typeof value.titleKey === 'string' ? value.titleKey : undefined,
    authors,
    workDate,
    edition: typeof value.edition === 'string' ? value.edition : '',
    editionDate: typeof value.editionDate === 'string' ? value.editionDate : '',
  };
};

const sanitizeProfile = (value: unknown): SourceProfile | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const identityKey = typeof value.identityKey === 'string' ? value.identityKey.trim() : '';
  const source = sanitizeSharedSource(value.source);
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString();
  if (!id || !label || !identityKey || !source) return null;
  return { id, label, identityKey, source, updatedAt };
};

export const sanitizeSourceProfileFile = (parsed: unknown): SourceProfileFile => {
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.profiles)) {
    return emptyFile();
  }

  const profiles = parsed.profiles
    .map((profile) => sanitizeProfile(profile))
    .filter((profile): profile is SourceProfile => Boolean(profile));

  return { version: 1, profiles };
};

export const readSourceProfilesFile = async (): Promise<SourceProfileFile> => {
  const filePath = getProfilesPath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return sanitizeSourceProfileFile(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyFile();
    throw error;
  }
};

export const writeSourceProfilesFile = async (file: SourceProfileFile): Promise<void> => {
  const filePath = getProfilesPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(sanitizeSourceProfileFile(file), null, 2)}\n`, 'utf-8');
};

export const upsertSourceProfileInFile = async (profile: SourceProfile): Promise<SourceProfileFile> => {
  const file = await readSourceProfilesFile();
  const index = file.profiles.findIndex(
    (entry) => entry.identityKey === profile.identityKey || entry.id === profile.id,
  );
  const nextProfile = sanitizeProfile(profile);
  if (!nextProfile) throw new Error('Invalid source profile');

  if (index >= 0) {
    file.profiles[index] = nextProfile;
  } else {
    file.profiles.push(nextProfile);
  }

  file.profiles.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  await writeSourceProfilesFile(file);
  return file;
};

export const deleteSourceProfileFromFile = async (profileId: string): Promise<SourceProfileFile> => {
  const file = await readSourceProfilesFile();
  file.profiles = file.profiles.filter((profile) => profile.id !== profileId);
  await writeSourceProfilesFile(file);
  return file;
};
