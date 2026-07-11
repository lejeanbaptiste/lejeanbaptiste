/**
 * Offline CBDB/DILA lifecycle: fetch packs from GitHub → optional raw reference data.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  COMPILE_POLICY_VERSION,
  LIFECYCLE_FILENAME,
  type AuthorityLifecycleProfile,
  type AuthorityLifecycleConfig,
  type AuthorityLifecycleProgress,
  type AuthorityLifecycleRunResult,
  type AuthorityLifecycleSetEnabledOptions,
  type AuthorityLifecycleStatus,
} from '../../commons/src/desktop/authorityLifecycleTypes';
import type { AuthorityPacksIndex } from '../../commons/src/desktop/authorityPackRegistryTypes';
import {
  AUTHORITY_PACKS_DIRNAME,
  type AuthorityPackId,
} from '../../commons/src/desktop/authorityPackTypes';
import { compileAuthorityPacks } from './authorityCompile';
import {
  fetchRemotePacksIndex,
  installPackBundle,
  readInstalledPacksManifest,
  remotePackUpdateAvailable,
} from './authorityPackRegistry';
import {
  AUTHORITY_DB_DIRNAME,
  AUTHORITY_SOURCES,
  downloadAuthoritySource,
  getAuthorityStatuses,
  type AuthorityDownloadProgress,
} from './authorityDatabases';
import { getAuthorityPackStatuses } from './authorityPacks';

export {
  COMPILE_POLICY_VERSION,
  LIFECYCLE_FILENAME,
  type AuthorityLifecycleConfig,
  type AuthorityLifecycleProgress,
  type AuthorityLifecycleRunResult,
  type AuthorityLifecycleSetEnabledOptions,
  type AuthorityLifecycleStatus,
} from '../../commons/src/desktop/authorityLifecycleTypes';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_LIFECYCLE: AuthorityLifecycleConfig = {
  version: 1,
  enabled: false,
  profile: 'chinese',
  referenceDataEnabled: false,
  declinedFirstPrompt: false,
};

const PROFILE_SPECS: Record<
  AuthorityLifecycleProfile,
  {
    label: string;
    packIds: AuthorityPackId[];
    rawSourceIds: ('cbdb' | 'dila')[];
    supportsReferenceData: boolean;
  }
> = {
  chinese: {
    label: 'Offline Chinese authorities (CBDB + DILA + Wikidata)',
    packIds: [
      'cbdb-persons',
      'cbdb-places',
      'cbdb-offices',
      'dila-persons',
      'dila-places',
      'wikidata-persons-pre-ming',
      'wikidata-persons-ming',
      'wikidata-persons-qing',
      'wikidata-orgs-zh-hant',
      'wikidata-works-zh-hant',
    ],
    rawSourceIds: ['cbdb', 'dila'],
    supportsReferenceData: true,
  },
  japanese: {
    label: 'Offline Japanese authorities (NDL + Wikidata)',
    packIds: [
      'ndl-persons',
      'ndl-places',
      'ndl-orgs',
      'ndl-works',
      'wikidata-persons-ja',
      'wikidata-orgs-ja',
      'wikidata-works-ja',
    ],
    rawSourceIds: [],
    supportsReferenceData: false,
  },
  tibetan: {
    label: 'Offline Tibetan authorities (Wikidata)',
    packIds: ['wikidata-persons-bo', 'wikidata-places-bo', 'wikidata-orgs-bo'],
    rawSourceIds: [],
    supportsReferenceData: false,
  },
};

let pipelineBusy = false;
let cachedRemoteIndex: AuthorityPacksIndex | null = null;
let cachedRemoteIndexAt = 0;
const REMOTE_INDEX_TTL_MS = 5 * 60 * 1000;

const lifecyclePath = (entityDbFolder: string): string =>
  path.join(entityDbFolder, AUTHORITY_DB_DIRNAME, LIFECYCLE_FILENAME);

const useCompileFallback = (): boolean =>
  process.env.AUTHORITY_LIFECYCLE_COMPILE_FALLBACK === '1';

const normalizeProfile = (
  profile: AuthorityLifecycleProfile | null | undefined,
): AuthorityLifecycleProfile =>
  profile === 'japanese' || profile === 'tibetan' ? profile : 'chinese';

const profileSpec = (profile: AuthorityLifecycleProfile) => PROFILE_SPECS[profile];

export const parseLifecycleConfig = (raw: string): AuthorityLifecycleConfig | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<AuthorityLifecycleConfig>;
    if (parsed.version !== 1) return null;
    if (typeof parsed.enabled !== 'boolean') return null;
    return {
      version: 1,
      enabled: parsed.enabled,
      profile: normalizeProfile(parsed.profile),
      referenceDataEnabled:
        typeof parsed.referenceDataEnabled === 'boolean' ? parsed.referenceDataEnabled : false,
      lastCheckAt: typeof parsed.lastCheckAt === 'string' ? parsed.lastCheckAt : undefined,
      compilePolicyVersion:
        typeof parsed.compilePolicyVersion === 'string'
          ? parsed.compilePolicyVersion
          : undefined,
      packBundleVersion:
        typeof parsed.packBundleVersion === 'string' ? parsed.packBundleVersion : undefined,
      declinedFirstPrompt:
        typeof parsed.declinedFirstPrompt === 'boolean' ? parsed.declinedFirstPrompt : false,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : undefined,
    };
  } catch {
    return null;
  }
};

export const readLifecycleConfig = async (
  entityDbFolder: string | null,
): Promise<AuthorityLifecycleConfig> => {
  if (!entityDbFolder) return { ...DEFAULT_LIFECYCLE };
  try {
    const parsed = parseLifecycleConfig(
      await fsp.readFile(lifecyclePath(entityDbFolder), 'utf-8'),
    );
    return parsed ?? { ...DEFAULT_LIFECYCLE };
  } catch {
    return { ...DEFAULT_LIFECYCLE };
  }
};

export const writeLifecycleConfig = async (
  entityDbFolder: string,
  patch: Partial<AuthorityLifecycleConfig>,
): Promise<AuthorityLifecycleConfig> => {
  const current = await readLifecycleConfig(entityDbFolder);
  const next: AuthorityLifecycleConfig = {
    ...current,
    ...patch,
    version: 1,
  };
  const dir = path.join(entityDbFolder, AUTHORITY_DB_DIRNAME);
  await fsp.mkdir(dir, { recursive: true });
  const target = lifecyclePath(entityDbFolder);
  const temp = `${target}.tmp`;
  await fsp.writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
  await fsp.rename(temp, target);
  return next;
};

const sumDirectoryBytes = async (dirPath: string): Promise<number> => {
  let total = 0;
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await sumDirectoryBytes(full);
      } else if (entry.isFile()) {
        total += (await fsp.stat(full)).size;
      }
    }
  } catch {
    return 0;
  }
  return total;
};

export const entityDbFolderReady = (entityDbFolder: string | null): boolean =>
  !!entityDbFolder?.trim() && fs.existsSync(path.join(entityDbFolder, 'entities.xml'));

const packsReady = (packStatuses: ReturnType<typeof getAuthorityPackStatuses>): boolean =>
  packStatuses.every((pack) => pack.installed);

export const getRemotePacksIndexCached = async (): Promise<AuthorityPacksIndex | null> => {
  if (cachedRemoteIndex && Date.now() - cachedRemoteIndexAt < REMOTE_INDEX_TTL_MS) {
    return cachedRemoteIndex;
  }
  try {
    cachedRemoteIndex = await fetchRemotePacksIndex();
    cachedRemoteIndexAt = Date.now();
    return cachedRemoteIndex;
  } catch {
    return null;
  }
};

export const isUpdateAvailable = (
  lifecycle: AuthorityLifecycleConfig,
  packStatuses: ReturnType<typeof getAuthorityPackStatuses>,
  localPackManifest: Awaited<ReturnType<typeof readInstalledPacksManifest>>,
  remoteIndex: AuthorityPacksIndex | null,
  rawSources: Awaited<ReturnType<typeof getAuthorityStatuses>>,
): boolean => {
  if (!lifecycle.enabled) return false;
  const profile = normalizeProfile(lifecycle.profile);
  const spec = profileSpec(profile);

  if (!packsReady(packStatuses)) return true;

  if (lifecycle.compilePolicyVersion !== COMPILE_POLICY_VERSION) return true;

  if (
    remoteIndex &&
    remotePackUpdateAvailable(localPackManifest, remoteIndex, COMPILE_POLICY_VERSION, profile)
  ) {
    return true;
  }

  if (!localPackManifest && remoteIndex) return true;

  if (lifecycle.referenceDataEnabled && spec.supportsReferenceData) {
    for (const sourceSpec of AUTHORITY_SOURCES.filter((source) =>
      spec.rawSourceIds.includes(source.id),
    )) {
      const status = rawSources.find((source) => source.id === sourceSpec.id);
      if (!status?.installed || status.version !== sourceSpec.version) return true;
    }
  }

  return false;
};

export const getAuthorityLifecycleStatus = async (
  entityDbFolder: string | null,
): Promise<AuthorityLifecycleStatus> => {
  const ready = entityDbFolderReady(entityDbFolder);
  const rawDir = ready ? path.join(entityDbFolder!, AUTHORITY_DB_DIRNAME) : null;
  const lifecycle = await readLifecycleConfig(entityDbFolder);
  const profile = normalizeProfile(lifecycle.profile);
  const spec = profileSpec(profile);
  const rawSources = (await getAuthorityStatuses(rawDir)).filter((source) =>
    spec.rawSourceIds.includes(source.id),
  );
  const packs = ready
    ? getAuthorityPackStatuses(entityDbFolder!).filter((pack) => spec.packIds.includes(pack.id))
    : [];
  const localPackManifest = ready ? await readInstalledPacksManifest(entityDbFolder!) : null;
  const remoteIndex = lifecycle.enabled ? await getRemotePacksIndexCached() : null;

  let diskUsage: AuthorityLifecycleStatus['diskUsage'] = null;
  if (ready) {
    const rawBytes = rawDir ? await sumDirectoryBytes(rawDir) : 0;
    const packBytes = await sumDirectoryBytes(path.join(entityDbFolder!, AUTHORITY_PACKS_DIRNAME));
    diskUsage = { rawBytes, packBytes };
  }

  return {
    enabled: lifecycle.enabled,
    profile,
    entityDbFolder,
    entityDbReady: ready,
    label: spec.label,
    rawSources,
    packs,
    packsReady: packsReady(packs),
    diskUsage,
    updateAvailable: isUpdateAvailable(
      lifecycle,
      packs,
      localPackManifest,
      remoteIndex,
      rawSources,
    ),
    compilePolicyVersion: COMPILE_POLICY_VERSION,
    packBundleVersion: localPackManifest?.bundleVersion ?? lifecycle.packBundleVersion,
    referenceDataEnabled: lifecycle.referenceDataEnabled ?? false,
    lastCheckAt: lifecycle.lastCheckAt,
    declinedFirstPrompt: lifecycle.declinedFirstPrompt ?? false,
    busy: pipelineBusy,
    lastError: lifecycle.lastError,
  };
};

export interface RunAuthorityLifecyclePipelineOptions {
  entityDbFolder: string;
  profile?: AuthorityLifecycleProfile;
  forceDownload?: boolean;
  onProgress?: (progress: AuthorityLifecycleProgress) => void;
}

const installPacksFromGitHub = async ({
  entityDbFolder,
  profile,
  forceDownload,
  onProgress,
}: RunAuthorityLifecyclePipelineOptions): Promise<AuthorityPacksIndex> => {
  onProgress?.({ phase: 'downloading', message: 'Checking authority pack registry…' });
  const index = await fetchRemotePacksIndex();
  cachedRemoteIndex = index;
  cachedRemoteIndexAt = Date.now();

  await installPackBundle({
    entityDbFolder,
    index,
    profile,
    force: forceDownload,
    onProgress: (message, receivedBytes, totalBytes) => {
      onProgress?.({
        phase: message.startsWith('Extracting') ? 'extracting' : 'downloading',
        message,
        receivedBytes,
        totalBytes,
      });
    },
  });

  return index;
};

const installPacksViaCompileFallback = async ({
  entityDbFolder,
  onProgress,
}: RunAuthorityLifecyclePipelineOptions): Promise<void> => {
  const newPacksDir = path.join(entityDbFolder, `${AUTHORITY_PACKS_DIRNAME}.new`);
  await fsp.rm(newPacksDir, { recursive: true, force: true });

  onProgress?.({ phase: 'compiling', message: 'Compiling authority packs locally…' });
  await compileAuthorityPacks({
    entityDbFolder,
    outDir: newPacksDir,
    onProgress: (message) => onProgress?.({ phase: 'compiling', message }),
  });

  const liveDir = path.join(entityDbFolder, AUTHORITY_PACKS_DIRNAME);
  const bakDir = path.join(entityDbFolder, `${AUTHORITY_PACKS_DIRNAME}.bak`);
  await fsp.rm(bakDir, { recursive: true, force: true });
  if (fs.existsSync(liveDir)) await fsp.rename(liveDir, bakDir);
  try {
    await fsp.rename(newPacksDir, liveDir);
  } catch (error) {
    if (fs.existsSync(bakDir) && !fs.existsSync(liveDir)) await fsp.rename(bakDir, liveDir);
    throw error;
  }
  await fsp.rm(bakDir, { recursive: true, force: true });
};

/** Fetch GitHub pack bundle; optionally refresh raw reference databases. */
export const runAuthorityLifecyclePipeline = async (
  options: RunAuthorityLifecyclePipelineOptions,
): Promise<AuthorityLifecycleRunResult> => {
  const { entityDbFolder, forceDownload = false, onProgress } = options;

  if (pipelineBusy) return { ok: false, error: 'Authority update already in progress.' };
  if (!entityDbFolderReady(entityDbFolder)) {
    return {
      ok: false,
      error: 'Configure an entity database folder containing entities.xml before enabling authorities.',
    };
  }

  pipelineBusy = true;
  const rawDir = path.join(entityDbFolder, AUTHORITY_DB_DIRNAME);
  const lifecycle = await readLifecycleConfig(entityDbFolder);
  const profile = normalizeProfile(options.profile ?? lifecycle.profile);
  const spec = profileSpec(profile);

  const emitDownload = (progress: AuthorityDownloadProgress) => {
    onProgress?.({
      phase: progress.phase,
      message: `${progress.sourceId.toUpperCase()}: ${progress.fileName}`,
      sourceId: progress.sourceId,
      receivedBytes: progress.receivedBytes,
      totalBytes: progress.totalBytes,
    });
  };

  try {
    let packIndex: AuthorityPacksIndex | null = null;

    if (useCompileFallback()) {
      await installPacksViaCompileFallback(options);
    } else {
      packIndex = await installPacksFromGitHub(options);
    }

    if (lifecycle.referenceDataEnabled && spec.supportsReferenceData) {
      const statuses = await getAuthorityStatuses(rawDir);
      for (const sourceSpec of AUTHORITY_SOURCES.filter((source) =>
        spec.rawSourceIds.includes(source.id),
      )) {
        const status = statuses.find((source) => source.id === sourceSpec.id);
        const needsDownload =
          forceDownload || !status?.installed || status.version !== sourceSpec.version;
        if (!needsDownload) continue;

        onProgress?.({
          phase: 'downloading',
          message: `Downloading reference data: ${sourceSpec.label}…`,
          sourceId: sourceSpec.id,
        });
        await downloadAuthoritySource(rawDir, sourceSpec.id, emitDownload);
      }
    }

    await writeLifecycleConfig(entityDbFolder, {
      enabled: true,
      profile,
      compilePolicyVersion: packIndex?.compilePolicyVersion ?? COMPILE_POLICY_VERSION,
      packBundleVersion: packIndex?.bundleVersion,
      lastCheckAt: new Date().toISOString(),
      lastError: undefined,
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeLifecycleConfig(entityDbFolder, { lastError: message }).catch(() => undefined);
    return { ok: false, error: message };
  } finally {
    pipelineBusy = false;
  }
};

export const setAuthorityLifecycleEnabled = async (
  entityDbFolder: string | null,
  options: AuthorityLifecycleSetEnabledOptions,
  onProgress?: (progress: AuthorityLifecycleProgress) => void,
): Promise<AuthorityLifecycleRunResult> => {
  if (options.enabled) {
    if (!entityDbFolder) {
      return { ok: false, error: 'No entity database folder configured.' };
    }
    const profile = normalizeProfile(options.profile);
    await writeLifecycleConfig(entityDbFolder, {
      enabled: true,
      profile,
      declinedFirstPrompt: false,
    });
    const status = await getAuthorityLifecycleStatus(entityDbFolder);
    if (status.profile === profile && status.packsReady && !status.updateAvailable) {
      return { ok: true };
    }
    return runAuthorityLifecyclePipeline({ entityDbFolder, profile, onProgress });
  }

  if (!entityDbFolder) {
    return { ok: true };
  }

  await writeLifecycleConfig(entityDbFolder, {
    enabled: false,
    profile: normalizeProfile(options.profile),
    lastError: undefined,
  });

  if (options.deleteFiles) {
    await fsp.rm(path.join(entityDbFolder, AUTHORITY_DB_DIRNAME), {
      recursive: true,
      force: true,
    });
    await fsp.rm(path.join(entityDbFolder, AUTHORITY_PACKS_DIRNAME), {
      recursive: true,
      force: true,
    });
  }

  return { ok: true };
};

export const recordDeclinedFirstPrompt = async (
  entityDbFolder: string,
  profile: AuthorityLifecycleProfile = 'chinese',
): Promise<void> => {
  await writeLifecycleConfig(entityDbFolder, {
    enabled: false,
    profile,
    declinedFirstPrompt: true,
  });
};

export const maybeCheckAuthorityUpdates = async (
  entityDbFolder: string | null,
): Promise<AuthorityLifecycleStatus | null> => {
  if (!entityDbFolderReady(entityDbFolder)) return null;

  const lifecycle = await readLifecycleConfig(entityDbFolder);
  if (!lifecycle.enabled) return null;

  const lastCheck = lifecycle.lastCheckAt ? Date.parse(lifecycle.lastCheckAt) : 0;
  if (Date.now() - lastCheck < WEEK_MS) {
    return getAuthorityLifecycleStatus(entityDbFolder);
  }

  cachedRemoteIndex = null;
  await writeLifecycleConfig(entityDbFolder!, { lastCheckAt: new Date().toISOString() });
  return getAuthorityLifecycleStatus(entityDbFolder);
};

export const deleteAuthorityData = async (entityDbFolder: string): Promise<void> => {
  await fsp.rm(path.join(entityDbFolder, AUTHORITY_DB_DIRNAME), { recursive: true, force: true });
  await fsp.rm(path.join(entityDbFolder, AUTHORITY_PACKS_DIRNAME), {
    recursive: true,
    force: true,
  });
};

/** @internal test helper */
export const _setPipelineBusyForTests = (value: boolean): void => {
  pipelineBusy = value;
};

/** @internal test helper */
export const _clearRemoteIndexCacheForTests = (): void => {
  cachedRemoteIndex = null;
  cachedRemoteIndexAt = 0;
};
