import { app, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { recoverFromFailedAtomicWrite, writeFileAtomic } from './atomicWrite';

interface AppPrefs {
  lastProjectFile: string | null;
  encoderName?: string;
  aiApi?: AiApiSettings;
  rememberWorkspaceOnStartup?: boolean;
  workspaceSession?: WorkspaceSession;
  entityDbFolder?: string | null;
  /** Explicit override for where achievements.json lives; see getAchievementsFolder. */
  achievementsFolder?: string | null;
  /** Last directory used in a system open/save dialog. */
  lastDialogDir?: string | null;
}

const PREFS_FILENAME = 'project-prefs.json';

export interface WorkspaceSession {
  activeFilePath: string | null;
  cursorPositions?: Record<string, WorkspaceCursorPosition>;
  openFilePaths: string[];
  projectFilePath: string | null;
}

export type WorkspaceCursorPosition =
  | { mode: 'source'; offset: number }
  | { mode: 'visual'; offsetInElementText: number; teiXPath: string };

export interface AiApiSettings {
  apiKey: string;
  baseUrl: string;
  customInstructions: string;
  model: string;
  temperature: number;
  /** Show verified chunks immediately instead of waiting for the full run. */
  streamResults: boolean;
  /** Successful connection test for this exact endpoint and model. */
  verifiedAt: string | null;
  verifiedBaseUrl: string;
  verifiedModel: string;
}

export const DEFAULT_AI_API_SETTINGS: AiApiSettings = {
  apiKey: '',
  baseUrl: 'http://localhost:1234/v1',
  customInstructions: '',
  model: '',
  temperature: 0.1,
  streamResults: false,
  verifiedAt: null,
  verifiedBaseUrl: '',
  verifiedModel: '',
};

const sanitizeAiApiSettings = (value: Partial<AiApiSettings> | undefined): AiApiSettings => {
  const temperature =
    typeof value?.temperature === 'number' && Number.isFinite(value.temperature)
      ? Math.min(2, Math.max(0, value.temperature))
      : DEFAULT_AI_API_SETTINGS.temperature;

  return {
    apiKey: typeof value?.apiKey === 'string' ? value.apiKey : DEFAULT_AI_API_SETTINGS.apiKey,
    baseUrl:
      typeof value?.baseUrl === 'string' && value.baseUrl.trim()
        ? value.baseUrl.trim()
        : DEFAULT_AI_API_SETTINGS.baseUrl,
    customInstructions:
      typeof value?.customInstructions === 'string' ? value.customInstructions : '',
    model: typeof value?.model === 'string' ? value.model.trim() : '',
    temperature,
    streamResults: value?.streamResults === true,
    verifiedAt: typeof value?.verifiedAt === 'string' ? value.verifiedAt : null,
    verifiedBaseUrl: typeof value?.verifiedBaseUrl === 'string' ? value.verifiedBaseUrl.trim() : '',
    verifiedModel: typeof value?.verifiedModel === 'string' ? value.verifiedModel.trim() : '',
  };
};

const sanitizeWorkspaceSession = (value: WorkspaceSession | undefined): WorkspaceSession => {
  const openFilePaths = Array.isArray(value?.openFilePaths)
    ? value.openFilePaths.filter((filePath): filePath is string => typeof filePath === 'string')
    : [];
  const cursorPositions: Record<string, WorkspaceCursorPosition> = {};

  if (value?.cursorPositions && typeof value.cursorPositions === 'object') {
    for (const [filePath, position] of Object.entries(value.cursorPositions)) {
      if (typeof filePath !== 'string' || !position || typeof position !== 'object') continue;
      if (position.mode === 'source' && typeof position.offset === 'number') {
        cursorPositions[filePath] = { mode: 'source', offset: position.offset };
      } else if (
        position.mode === 'visual' &&
        typeof position.teiXPath === 'string' &&
        typeof position.offsetInElementText === 'number'
      ) {
        cursorPositions[filePath] = {
          mode: 'visual',
          offsetInElementText: position.offsetInElementText,
          teiXPath: position.teiXPath,
        };
      }
    }
  }

  return {
    activeFilePath: typeof value?.activeFilePath === 'string' ? value.activeFilePath : null,
    cursorPositions,
    openFilePaths: Array.from(new Set(openFilePaths)),
    projectFilePath: typeof value?.projectFilePath === 'string' ? value.projectFilePath : null,
  };
};

const getPrefsPath = () => path.join(app.getPath('userData'), PREFS_FILENAME);

const DEFAULT_ENTITY_DB_DIRNAME = 'entity-database';

const getDefaultEntityDbFolder = () =>
  path.join(app.getPath('userData'), DEFAULT_ENTITY_DB_DIRNAME);

const defaultAppPrefs = (): AppPrefs => ({
  lastProjectFile: null,
  encoderName: '',
  aiApi: DEFAULT_AI_API_SETTINGS,
  rememberWorkspaceOnStartup: true,
  workspaceSession: sanitizeWorkspaceSession(undefined),
  entityDbFolder: null,
  achievementsFolder: null,
});

const readCommonPrefs = (
  parsed: Partial<AppPrefs> & { lastRootPath?: string | null },
): Omit<AppPrefs, 'lastProjectFile'> => ({
  encoderName: typeof parsed.encoderName === 'string' ? parsed.encoderName : '',
  aiApi: sanitizeAiApiSettings(parsed.aiApi),
  rememberWorkspaceOnStartup: parsed.rememberWorkspaceOnStartup !== false,
  workspaceSession: sanitizeWorkspaceSession(parsed.workspaceSession),
  entityDbFolder:
    typeof parsed.entityDbFolder === 'string' ? parsed.entityDbFolder.trim() || null : null,
  achievementsFolder:
    typeof parsed.achievementsFolder === 'string' ? parsed.achievementsFolder.trim() || null : null,
});

/** Parse stored prefs JSON. Exported for unit tests. */
export const parseAppPrefs = (
  parsed: Partial<AppPrefs> & { lastRootPath?: string | null },
): AppPrefs => {
  const common = readCommonPrefs(parsed);

  if (typeof parsed.lastProjectFile === 'string') {
    return { ...common, lastProjectFile: parsed.lastProjectFile };
  }

  if (typeof parsed.lastRootPath === 'string') {
    return {
      ...common,
      lastProjectFile: path.join(parsed.lastRootPath, 'jean-baptiste.project.json'),
    };
  }

  return {
    ...common,
    lastProjectFile: null,
  };
};

const readAppPrefs = async (): Promise<AppPrefs> => {
  const prefsPath = getPrefsPath();
  try {
    await recoverFromFailedAtomicWrite(prefsPath);
    const raw = await fs.readFile(prefsPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppPrefs> & { lastRootPath?: string | null };
    return parseAppPrefs(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultAppPrefs();
    const corruptPath = `${prefsPath}.corrupt-${Date.now()}`;
    await fs.rename(prefsPath, corruptPath).catch(() => undefined);
    return defaultAppPrefs();
  }
};

const writeAppPrefs = async (prefs: AppPrefs) => {
  await writeFileAtomic(getPrefsPath(), JSON.stringify(prefs, null, 2));
};

/** Serialize read-modify-write so concurrent saves cannot clobber fields like entityDbFolder. */
let prefsWriteChain: Promise<void> = Promise.resolve();

const mutateAppPrefs = async (mutator: (prefs: AppPrefs) => void): Promise<void> => {
  prefsWriteChain = prefsWriteChain.then(async () => {
    const prefs = await readAppPrefs();
    mutator(prefs);
    await writeAppPrefs(prefs);
  });
  await prefsWriteChain;
};

export const writeLastProjectFile = async (projectFilePath: string) => {
  await mutateAppPrefs((prefs) => {
    prefs.lastProjectFile = projectFilePath;
  });
};

export const getValidLastProjectFile = async (): Promise<string | null> => {
  const prefs = await readAppPrefs();
  if (!prefs.lastProjectFile) return null;

  try {
    const stat = await fs.stat(prefs.lastProjectFile);
    if (stat.isFile()) return prefs.lastProjectFile;
  } catch {
    // Project file was moved or deleted.
  }

  return null;
};

export const getEncoderName = async (): Promise<string> => {
  const prefs = await readAppPrefs();
  return prefs.encoderName?.trim() ?? '';
};

export const setEncoderName = async (encoderName: string) => {
  await mutateAppPrefs((prefs) => {
    prefs.encoderName = encoderName.trim();
  });
};

export const getLastDialogDir = async (): Promise<string | null> => {
  const prefs = await readAppPrefs();
  const dir = prefs.lastDialogDir?.trim();
  return dir || null;
};

export const setLastDialogDir = async (dir: string | null) => {
  await mutateAppPrefs((prefs) => {
    prefs.lastDialogDir = dir?.trim() || null;
  });
};

/**
 * Returns the user's chosen entity-database folder, or auto-creates and
 * persists a fixed default under Electron's per-platform app-data directory
 * the first time this is called. Never returns null in practice; callers
 * that picked a custom folder in the past keep using it unchanged.
 *
 * Deliberately trusts prefs.entityDbFolder as-is with no existence checks,
 * retries, or fallback to some other previously-used folder: this used to
 * auto-recover from history when entities.xml wasn't immediately found, but
 * that misfired on ordinary transient conditions (a synced/network folder
 * not yet mounted) and silently pointed people at the wrong database. If
 * this folder is genuinely unreachable, callers see that directly instead of
 * being quietly redirected somewhere else.
 */
let hasShownEntityDbCreationError = false;

export const getEntityDbFolder = async (): Promise<string | null> => {
  const prefs = await readAppPrefs();
  const folder = prefs.entityDbFolder?.trim();
  if (folder) return folder;

  const defaultFolder = getDefaultEntityDbFolder();
  try {
    await fs.mkdir(defaultFolder, { recursive: true });
    await mutateAppPrefs((p) => {
      p.entityDbFolder = defaultFolder;
    });
  } catch (error) {
    // Surface the failure instead of throwing: an uncaught rejection here
    // propagates through the IPC call and leaves the settings panel showing
    // a blank folder path with no indication why. console.error alone is
    // invisible in a packaged build with devtools closed, so also show a
    // native dialog once per session - entity tagging is fully blocked
    // until this folder exists, so this needs to reach the user, not just
    // the log. (mkdir failing means nothing gets persisted, so every call
    // here retries and would otherwise re-show the dialog every time.)
    console.error('Failed to create default entity database folder:', error);
    if (!hasShownEntityDbCreationError) {
      hasShownEntityDbCreationError = true;
      const detail = error instanceof Error ? error.message : String(error);
      dialog.showErrorBox(
        'Could not create your entity database folder',
        `Le Jean-Baptiste could not create:\n${defaultFolder}\n\n${detail}\n\nEntity tagging will be unavailable until you choose a writable folder in Settings > Entity database.`,
      );
    }
  }
  return defaultFolder;
};

/** Setting a new folder forgets the old one completely - no history is kept to fall back to. */
export const setEntityDbFolder = async (folder: string | null) => {
  await mutateAppPrefs((prefs) => {
    prefs.entityDbFolder = folder?.trim() || null;
  });
};

const LOCAL_AUTHORITY_ASSETS_DIRNAME = 'authority-assets';
/** Historically these lived inside the (often cloud-synced) entity database folder; see getLocalAuthorityAssetsDir. */
const MIGRATED_AUTHORITY_SUBDIRS = ['authority-packs', 'authority-databases'] as const;
let authorityAssetsMigrationAttempted = false;

const moveDirectory = async (source: string, dest: string): Promise<void> => {
  try {
    await fs.rename(source, dest);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    // Source and destination are on different volumes - fall back to copy+delete.
    await fs.cp(source, dest, { recursive: true });
    await fs.rm(source, { recursive: true, force: true });
  }
};

/**
 * Base directory for downloaded authority-pack/database assets (CBDB, DILA,
 * compiled Wikidata packs, CHGIS, etc.) - always the local per-machine
 * app-data folder, never inside the entity database folder. These can run
 * into the hundreds of MB, and the entity database folder is commonly
 * synced (Dropbox/iCloud/etc.); syncing that much data would be slow and
 * wasteful, and it re-creates exactly the "is this folder really here yet"
 * race that has already caused real data loss elsewhere in this app (see
 * EntityStore.loadEntities()'s retry logic).
 *
 * One-time, best-effort migration: if a legacy install already downloaded
 * these under the entity database folder, move them here instead of forcing
 * a re-download. Attempted at most once per app session; a failure just
 * leaves the legacy copy in place and retries on next launch.
 */
export const getLocalAuthorityAssetsDir = async (): Promise<string> => {
  const dir = path.join(app.getPath('userData'), LOCAL_AUTHORITY_ASSETS_DIRNAME);
  await fs.mkdir(dir, { recursive: true });

  if (!authorityAssetsMigrationAttempted) {
    authorityAssetsMigrationAttempted = true;
    const legacyFolder = await getEntityDbFolder();
    if (legacyFolder) {
      for (const name of MIGRATED_AUTHORITY_SUBDIRS) {
        const legacyPath = path.join(legacyFolder, name);
        const newPath = path.join(dir, name);
        try {
          const [legacyExists, newExists] = await Promise.all([
            fs.access(legacyPath).then(() => true).catch(() => false),
            fs.access(newPath).then(() => true).catch(() => false),
          ]);
          if (legacyExists && !newExists) {
            await moveDirectory(legacyPath, newPath);
          }
        } catch (error) {
          console.error(`Failed to migrate ${name} out of the entity database folder:`, error);
        }
      }
    }
  }

  return dir;
};

/**
 * Explicit override for where achievements.json lives. Returns null when
 * unset, meaning achievementsFile.ts falls back to the entity database
 * folder, then userData - this setting exists so a player can put their
 * medals somewhere synced (e.g. a Dropbox/iCloud folder) even when they
 * don't use a shared entity database at all.
 */
export const getAchievementsFolder = async (): Promise<string | null> => {
  const prefs = await readAppPrefs();
  return prefs.achievementsFolder?.trim() || null;
};

export const setAchievementsFolder = async (folder: string | null) => {
  await mutateAppPrefs((prefs) => {
    prefs.achievementsFolder = folder?.trim() || null;
  });
};

export const getAiApiSettings = async (): Promise<AiApiSettings> => {
  const prefs = await readAppPrefs();
  return sanitizeAiApiSettings(prefs.aiApi);
};

export const setAiApiSettings = async (settings: Partial<AiApiSettings>) => {
  await mutateAppPrefs((prefs) => {
    prefs.aiApi = sanitizeAiApiSettings(settings);
  });
};

export const getRememberWorkspaceOnStartup = async (): Promise<boolean> => {
  const prefs = await readAppPrefs();
  return prefs.rememberWorkspaceOnStartup !== false;
};

export const setRememberWorkspaceOnStartup = async (remember: boolean) => {
  await mutateAppPrefs((prefs) => {
    prefs.rememberWorkspaceOnStartup = remember;
  });
};

export const saveWorkspaceSession = async (session: WorkspaceSession) => {
  await mutateAppPrefs((prefs) => {
    const nextSession = sanitizeWorkspaceSession(session);
    const previousSession = sanitizeWorkspaceSession(prefs.workspaceSession);
    const openFilePathSet = new Set(nextSession.openFilePaths);
    nextSession.cursorPositions = {
      ...Object.fromEntries(
        Object.entries(previousSession.cursorPositions ?? {}).filter(([filePath]) =>
          openFilePathSet.has(filePath),
        ),
      ),
      ...(nextSession.cursorPositions ?? {}),
    };
    prefs.workspaceSession = nextSession;
    if (prefs.workspaceSession.projectFilePath) {
      prefs.lastProjectFile = prefs.workspaceSession.projectFilePath;
    }
  });
};

export const getWorkspaceSession = async (): Promise<WorkspaceSession | null> => {
  const prefs = await readAppPrefs();
  const session = sanitizeWorkspaceSession(prefs.workspaceSession);
  return session.projectFilePath ? session : null;
};
