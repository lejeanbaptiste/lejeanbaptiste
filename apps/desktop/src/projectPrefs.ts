import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

interface AppPrefs {
  lastProjectFile: string | null;
  encoderName?: string;
  aiApi?: AiApiSettings;
  rememberWorkspaceOnStartup?: boolean;
  workspaceSession?: WorkspaceSession;
  entityDbFolder?: string | null;
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

const defaultAppPrefs = (): AppPrefs => ({
  lastProjectFile: null,
  encoderName: '',
  aiApi: DEFAULT_AI_API_SETTINGS,
  rememberWorkspaceOnStartup: true,
  workspaceSession: sanitizeWorkspaceSession(undefined),
  entityDbFolder: null,
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
  try {
    const raw = await fs.readFile(getPrefsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppPrefs> & { lastRootPath?: string | null };
    return parseAppPrefs(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultAppPrefs();
    const corruptPath = `${getPrefsPath()}.corrupt-${Date.now()}`;
    await fs.rename(getPrefsPath(), corruptPath).catch(() => undefined);
    return defaultAppPrefs();
  }
};

const writeAppPrefs = async (prefs: AppPrefs) => {
  const prefsPath = getPrefsPath();
  const tempPath = `${prefsPath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(prefs, null, 2), 'utf-8');
  await fs.rename(tempPath, prefsPath);
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

export const getEntityDbFolder = async (): Promise<string | null> => {
  const prefs = await readAppPrefs();
  const folder = prefs.entityDbFolder?.trim();
  return folder || null;
};

export const setEntityDbFolder = async (folder: string | null) => {
  await mutateAppPrefs((prefs) => {
    prefs.entityDbFolder = folder?.trim() || null;
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
