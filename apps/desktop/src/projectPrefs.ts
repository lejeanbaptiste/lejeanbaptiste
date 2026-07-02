import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

interface AppPrefs {
  lastProjectFile: string | null;
  encoderName?: string;
  aiApi?: AiApiSettings;
  rememberWorkspaceOnStartup?: boolean;
  workspaceSession?: WorkspaceSession;
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
}

export const DEFAULT_AI_API_SETTINGS: AiApiSettings = {
  apiKey: 'lm-studio',
  baseUrl: 'http://localhost:1234/v1',
  customInstructions: '',
  model: '',
  temperature: 0.1,
};

const sanitizeAiApiSettings = (value: Partial<AiApiSettings> | undefined): AiApiSettings => {
  const temperature =
    typeof value?.temperature === 'number' && Number.isFinite(value.temperature)
      ? Math.min(2, Math.max(0, value.temperature))
      : DEFAULT_AI_API_SETTINGS.temperature;

  return {
    apiKey:
      typeof value?.apiKey === 'string' ? value.apiKey : DEFAULT_AI_API_SETTINGS.apiKey,
    baseUrl:
      typeof value?.baseUrl === 'string' && value.baseUrl.trim()
        ? value.baseUrl.trim()
        : DEFAULT_AI_API_SETTINGS.baseUrl,
    customInstructions:
      typeof value?.customInstructions === 'string' ? value.customInstructions : '',
    model: typeof value?.model === 'string' ? value.model.trim() : '',
    temperature,
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

const readAppPrefs = async (): Promise<AppPrefs> => {
  try {
    const raw = await fs.readFile(getPrefsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as AppPrefs & { lastRootPath?: string | null };

    if (typeof parsed.lastProjectFile === 'string') {
      return {
        lastProjectFile: parsed.lastProjectFile,
        encoderName: typeof parsed.encoderName === 'string' ? parsed.encoderName : '',
        aiApi: sanitizeAiApiSettings(parsed.aiApi),
        rememberWorkspaceOnStartup: parsed.rememberWorkspaceOnStartup !== false,
        workspaceSession: sanitizeWorkspaceSession(parsed.workspaceSession),
      };
    }

    if (typeof parsed.lastRootPath === 'string') {
      return {
        lastProjectFile: path.join(parsed.lastRootPath, 'jean-baptiste.project.json'),
        encoderName: typeof parsed.encoderName === 'string' ? parsed.encoderName : '',
        aiApi: sanitizeAiApiSettings(parsed.aiApi),
        rememberWorkspaceOnStartup: parsed.rememberWorkspaceOnStartup !== false,
        workspaceSession: sanitizeWorkspaceSession(parsed.workspaceSession),
      };
    }

    return {
      lastProjectFile: null,
      encoderName: '',
      aiApi: DEFAULT_AI_API_SETTINGS,
      rememberWorkspaceOnStartup: true,
      workspaceSession: sanitizeWorkspaceSession(undefined),
    };
  } catch {
    return {
      lastProjectFile: null,
      encoderName: '',
      aiApi: DEFAULT_AI_API_SETTINGS,
      rememberWorkspaceOnStartup: true,
      workspaceSession: sanitizeWorkspaceSession(undefined),
    };
  }
};

const writeAppPrefs = async (prefs: AppPrefs) => {
  await fs.writeFile(getPrefsPath(), JSON.stringify(prefs, null, 2), 'utf-8');
};

export const writeLastProjectFile = async (projectFilePath: string) => {
  const prefs = await readAppPrefs();
  prefs.lastProjectFile = projectFilePath;
  await writeAppPrefs(prefs);
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
  const prefs = await readAppPrefs();
  prefs.encoderName = encoderName.trim();
  await writeAppPrefs(prefs);
};

export const getAiApiSettings = async (): Promise<AiApiSettings> => {
  const prefs = await readAppPrefs();
  return sanitizeAiApiSettings(prefs.aiApi);
};

export const setAiApiSettings = async (settings: Partial<AiApiSettings>) => {
  const prefs = await readAppPrefs();
  prefs.aiApi = sanitizeAiApiSettings(settings);
  await writeAppPrefs(prefs);
};

export const getRememberWorkspaceOnStartup = async (): Promise<boolean> => {
  const prefs = await readAppPrefs();
  return prefs.rememberWorkspaceOnStartup !== false;
};

export const setRememberWorkspaceOnStartup = async (remember: boolean) => {
  const prefs = await readAppPrefs();
  prefs.rememberWorkspaceOnStartup = remember;
  await writeAppPrefs(prefs);
};

export const saveWorkspaceSession = async (session: WorkspaceSession) => {
  const prefs = await readAppPrefs();
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
  await writeAppPrefs(prefs);
};

export const getWorkspaceSession = async (): Promise<WorkspaceSession | null> => {
  const prefs = await readAppPrefs();
  const session = sanitizeWorkspaceSession(prefs.workspaceSession);
  return session.projectFilePath ? session : null;
};
