import { app } from 'electron';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import type { SourceProfile, SourceProfileFile } from '../../commons/src/desktop/sourceProfileTypes';
import { getEntityDbFolder } from './projectPrefs';

const PROFILES_FILENAME = 'source-profiles.json';

const getUserDataProfilesPath = () => path.join(app.getPath('userData'), PROFILES_FILENAME);

/**
 * Source profiles are shared reference data tied to the corpus, like
 * entities.xml and achievements.json, so they live inside the entity
 * database folder when one is configured - otherwise adopting someone
 * else's synced database folder wouldn't bring their source profiles along.
 * Falls back to the userData copy so existing installs don't lose data.
 */
const getProfilesPath = async (): Promise<string> => {
  const entityDbFolder = await getEntityDbFolder();
  if (entityDbFolder && existsSync(entityDbFolder)) {
    return path.join(entityDbFolder, PROFILES_FILENAME);
  }
  return getUserDataProfilesPath();
};

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

const readOneCandidate = async (filePath: string): Promise<SourceProfileFile | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return sanitizeSourceProfileFile(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

export const readSourceProfilesFile = async (): Promise<SourceProfileFile> => {
  const primaryPath = await getProfilesPath();
  const primary = await readOneCandidate(primaryPath);
  if (primary) return primary;

  // Falls back to the pre-migration userData location so upgrading doesn't
  // look like a wipe for installs that had profiles before this moved.
  const legacyPath = getUserDataProfilesPath();
  if (legacyPath !== primaryPath) {
    const legacy = await readOneCandidate(legacyPath);
    if (legacy) return legacy;
  }

  return emptyFile();
};

export const writeSourceProfilesFile = async (file: SourceProfileFile): Promise<void> => {
  const filePath = await getProfilesPath();
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
