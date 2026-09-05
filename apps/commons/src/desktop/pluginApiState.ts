import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * Bridges Grognard's Electron main process (which knows the active project) and
 * the commons server child process (which serves the external Word plugin's
 * HTTP API) without relying on fork() IPC — that channel only exists in
 * production, where main.ts forks the server; in dev the server is started
 * independently by npm scripts and has no IPC link to Electron at all. A
 * small state file works identically in both cases.
 */

const APP_NAME = 'Grognard';

/** Mirrors Electron's default `app.getPath('userData')` without depending on the `electron` module. */
const resolveDefaultUserDataDir = (): string => {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
      APP_NAME,
    );
  }
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), APP_NAME);
};

const PLUGIN_API_STATE_FILE_NAME = 'plugin-api-state.json';

export const resolvePluginApiStateFilePath = (userDataDir?: string): string =>
  path.join(userDataDir ?? resolveDefaultUserDataDir(), PLUGIN_API_STATE_FILE_NAME);

export interface PluginApiState {
  /** Shared secret the Word add-in must send as `Authorization: Bearer <token>`. */
  token: string;
  /** Absolute path to the currently open project, or null when no project is open. */
  projectRoot: string | null;
  /**
   * The central entity database (CEDB) folder — a single per-user store
   * (`getEntityDbFolder()` in projectPrefs.ts), available regardless of
   * whether any project is open. Unlike `projectRoot`, this is genuinely
   * user-configurable (not just an OS default), so it has to be resolved by
   * main.ts (which has access to app prefs) rather than recomputed here.
   */
  centralEntitiesFolder: string | null;
  updatedAt: string;
}

export const writePluginApiState = async (
  filePath: string,
  state: PluginApiState,
): Promise<void> => {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, JSON.stringify(state), 'utf8');
};

/** Synchronous read: routes call this per-request, so avoiding an async hop keeps handlers simple. */
export const readPluginApiState = (filePath: string): PluginApiState | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PluginApiState>;
    if (typeof parsed.token !== 'string') return null;
    return {
      token: parsed.token,
      projectRoot: typeof parsed.projectRoot === 'string' ? parsed.projectRoot : null,
      centralEntitiesFolder:
        typeof parsed.centralEntitiesFolder === 'string' ? parsed.centralEntitiesFolder : null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return null;
  }
};
