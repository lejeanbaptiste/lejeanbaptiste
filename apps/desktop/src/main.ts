import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  systemPreferences,
} from 'electron';
import { fork, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import {
  closeAllNativeDialogs,
  getTopNativeDialogWindow,
  initNativeDialogs,
  prewarmNativeDialog,
  registerNativeDialogIpc,
} from './nativeDialogs';
import {
  getAiApiSettings,
  getEncoderName,
  getRememberWorkspaceOnStartup,
  getValidLastProjectFile,
  getWorkspaceSession,
  saveWorkspaceSession,
  setAiApiSettings,
  setEncoderName,
  setRememberWorkspaceOnStartup,
  writeLastProjectFile,
  type AiApiSettings,
  type WorkspaceSession,
} from './projectPrefs';
import { loadOrCreateProject, loadProjectFile } from './projectFile';
import {
  createDirectory,
  deletePath,
  findXmlFilesByName,
  listProjectXmlFiles,
  movePath,
  renamePath,
} from './explorerFileOps';
import { OpenFileWatcher } from './openFileWatcher';
import {
  cancelZoteroPick,
  checkZoteroAvailability,
  listZoteroStyles,
  pickZoteroCitationCayw,
  searchZoteroItems,
} from './zoteroClient';
import { disposeLemminx, registerLemminxIpc } from './lemminx/lspBridge';
import { installCatalogSchema, installLocalSchema } from './schemaSetup';
import { applyCatalogSchemaUpdate, checkCatalogSchemaUpdate } from './checkSchemaUpdate';
import {
  createTimeMachineSnapshot,
  getDefaultTimeMachineRestorePath,
  listTimeMachineSnapshots,
  restoreTimeMachineSnapshotToProject,
  restoreTimeMachineSnapshotToDirectory,
} from './timeMachine';

const APP_NAME = 'Le Jean-Baptiste';

interface AiConnectionResult {
  error?: string;
  models?: string[];
  ok: boolean;
}

interface AiTranslationRequest {
  alignmentUnit: 'div' | 'p';
  sourceUnitXml: string;
  targetLanguage: string;
}

interface AiTranslationResult {
  error?: string;
  ok: boolean;
  translationXml?: string;
}

const normalizeOpenAiBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  const url = new URL(trimmed);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL must start with http:// or https://.');
  }
  return url.toString().replace(/\/+$/, '');
};

const testAiConnection = async (settings: Partial<AiApiSettings>): Promise<AiConnectionResult> => {
  const saved = await getAiApiSettings();
  const merged: AiApiSettings = { ...saved, ...settings };
  let baseUrl: string;

  try {
    baseUrl = normalizeOpenAiBaseUrl(merged.baseUrl);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid base URL.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (merged.apiKey.trim()) headers.Authorization = `Bearer ${merged.apiKey.trim()}`;

    const response = await fetch(`${baseUrl}/models`, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, error: `Server returned HTTP ${response.status}.` };
    }

    const body = (await response.json()) as { data?: Array<{ id?: unknown }> };
    const models = Array.isArray(body.data)
      ? body.data
          .map((model) => (typeof model.id === 'string' ? model.id : null))
          .filter((id): id is string => Boolean(id))
      : [];

    return { ok: true, models };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out.' };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not reach the AI API.',
    };
  } finally {
    clearTimeout(timeout);
  }
};

const listAiModels = async (settings: AiApiSettings): Promise<string[]> => {
  const baseUrl = normalizeOpenAiBaseUrl(settings.baseUrl);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;

  const response = await fetch(`${baseUrl}/models`, { headers });
  if (!response.ok) return [];

  const body = (await response.json()) as { data?: Array<{ id?: unknown }> };
  return Array.isArray(body.data)
    ? body.data
        .map((model) => (typeof model.id === 'string' ? model.id : null))
        .filter((id): id is string => Boolean(id))
    : [];
};

const parseTranslationXmlFromResponse = (content: string): string | null => {
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed) as { translationXml?: unknown; translation?: unknown };
    const value = parsed.translationXml ?? parsed.translation;
    return typeof value === 'string' ? value.trim() : null;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!fenced?.[1]) return null;
    try {
      const parsed = JSON.parse(fenced[1].trim()) as { translationXml?: unknown };
      return typeof parsed.translationXml === 'string' ? parsed.translationXml.trim() : null;
    } catch {
      return null;
    }
  }
};

const readErrorResponse = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  if (!text.trim()) return `Server returned HTTP ${response.status}.`;

  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: unknown } | string;
      message?: unknown;
    };
    if (typeof parsed.error === 'string') return parsed.error;
    if (typeof parsed.error?.message === 'string') return parsed.error.message;
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // Fall through to raw text.
  }

  return `Server returned HTTP ${response.status}: ${text.slice(0, 500)}`;
};

const buildTranslationRequestBody = (
  model: string,
  settings: AiApiSettings,
  { alignmentUnit, sourceUnitXml, targetLanguage }: AiTranslationRequest,
) => ({
  model,
  temperature: settings.temperature,
  messages: [
    {
      role: 'system',
      content:
        'You translate scholarly XML passages. Return JSON only with one string field named translationXml. Translate only the provided passage. Treat source TEI tags such as persName, placeName, orgName, officeName, date, term, title, and quote as semantic hints, but do not reproduce those source tags. Output only simple inline XML suitable for a rich text translation editor: plain text plus optional <b>, <i>, <u>, <s>, <sup>, <sub>, or <hi rend="bold|italic|underline|strikethrough|small-caps">. Do not wrap the result in p, div, translation, body, html, or markdown. Ensure the XML fragment is well formed.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        targetLanguage,
        alignmentUnit,
        customInstructions: settings.customInstructions,
        sourceUnitXml,
      }),
    },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'translation_result',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          translationXml: { type: 'string' },
        },
        required: ['translationXml'],
      },
    },
  },
});

const postAiTranslation = async (
  baseUrl: string,
  settings: AiApiSettings,
  request: AiTranslationRequest,
  model: string,
  signal: AbortSignal,
): Promise<Response> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;

  return fetch(`${baseUrl}/chat/completions`, {
    body: JSON.stringify(buildTranslationRequestBody(model, settings, request)),
    headers,
    method: 'POST',
    signal,
  });
};

const generateAiTranslation = async ({
  alignmentUnit,
  sourceUnitXml,
  targetLanguage,
}: AiTranslationRequest): Promise<AiTranslationResult> => {
  const settings = await getAiApiSettings();
  const request = { alignmentUnit, sourceUnitXml, targetLanguage };
  let baseUrl: string;

  try {
    baseUrl = normalizeOpenAiBaseUrl(settings.baseUrl);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid base URL.' };
  }

  let model = settings.model.trim();
  if (!model) {
    const models = await listAiModels(settings).catch(() => []);
    model = models[0] ?? '';
  }
  if (!model) {
    return { ok: false, error: 'Choose an AI model in Settings before generating.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    let response = await postAiTranslation(baseUrl, settings, request, model, controller.signal);

    if (response.status === 404 && settings.model.trim()) {
      const models = await listAiModels(settings).catch(() => []);
      const fallbackModel = models.find((candidate) => candidate !== model);
      if (fallbackModel) {
        response = await postAiTranslation(
          baseUrl,
          settings,
          request,
          fallbackModel,
          controller.signal,
        );
      }
    }

    if (!response.ok) {
      return { ok: false, error: await readErrorResponse(response) };
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return { ok: false, error: 'AI response did not include message content.' };
    }

    const translationXml = parseTranslationXmlFromResponse(content);
    if (!translationXml) {
      return { ok: false, error: 'AI response did not include translationXml.' };
    }

    return { ok: true, translationXml };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: 'Translation request timed out.' };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'AI translation failed.',
    };
  } finally {
    clearTimeout(timeout);
  }
};

// Hide macOS-injected Edit menu items (Emoji & Symbols, Start Dictation).
if (process.platform === 'darwin') {
  systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true);
  systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true);
}

// Must run before app.ready so macOS uses this name in the menu bar (dev and packaged).
app.setName(APP_NAME);

const getIconPath = () => {
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../../design');
  const pngPath = path.join(base, 'icon.png');
  const svgPath = path.join(base, 'icon.svg');

  // nativeImage loads PNG reliably; SVG often returns empty on macOS.
  if (existsSync(pngPath)) return pngPath;
  if (existsSync(svgPath)) return svgPath;
  return pngPath;
};

const getAppIcon = () => {
  const icon = nativeImage.createFromPath(getIconPath());
  return icon.isEmpty() ? undefined : icon;
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'crcao',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const registerCrcaoProtocol = () => {
  protocol.registerFileProtocol('crcao', (request, callback) => {
    try {
      const filePath = decodeURIComponent(request.url.slice('crcao://'.length));
      callback({ path: path.normalize(filePath) });
    } catch {
      callback({ error: -2 });
    }
  });
};

const isDev = !app.isPackaged;
const DEV_COMMONS_URL = process.env.COMMONS_URL ?? 'http://localhost:3000';
const PROD_SERVER_PORT = process.env.CRCAO_SERVER_PORT ?? '3847';
const DEV_READY_TIMEOUT_MS = 120_000;
const DEV_READY_POLL_MS = 1_000;

if (isDev) {
  app.setPath('userData', path.join(app.getPath('appData'), APP_NAME));
}

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let openFileWatcher: OpenFileWatcher | null = null;

const getCommonsPaths = () => {
  if (isDev) {
    return {
      publicPath: path.join(__dirname, '../../commons/public'),
      serverPath: path.join(__dirname, '../../commons/server/index.mjs'),
    };
  }
  return {
    publicPath: path.join(process.resourcesPath, 'commons/public'),
    serverPath: path.join(process.resourcesPath, 'commons/server/index.mjs'),
  };
};

const startCommonsServer = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const { serverPath } = getCommonsPaths();
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, PORT: PROD_SERVER_PORT, NODE_ENV: 'production' },
      stdio: 'pipe',
    });

    serverProcess.on('error', reject);

    const timeout = setTimeout(() => resolve(), 2000);

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      if (text.includes('listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[commons-server]', data.toString());
    });
  });
};

const waitForUrl = (url: string, timeoutMs = DEV_READY_TIMEOUT_MS): Promise<void> => {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = net.request({ method: 'HEAD', url });

      request.on('response', (response) => {
        const ok =
          response.statusCode !== undefined &&
          response.statusCode >= 200 &&
          response.statusCode < 400;

        if (ok) {
          resolve();
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${url} (status ${response.statusCode})`));
          return;
        }

        setTimeout(attempt, DEV_READY_POLL_MS);
      });

      request.on('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(attempt, DEV_READY_POLL_MS);
      });

      request.end();
    };

    attempt();
  });
};

const waitForDevCommons = async () => {
  await waitForUrl(`${DEV_COMMONS_URL}/project`);
  // Webpack dev build can take ~30s on first run; wait for the app bundle too.
  await waitForUrl(`${DEV_COMMONS_URL}/js/app.js`);
};

const getAppUrl = async (routePath = '/project'): Promise<string> => {
  if (isDev) {
    await waitForDevCommons();
    return `${DEV_COMMONS_URL}${routePath}`;
  }
  await startCommonsServer();
  return `http://127.0.0.1:${PROD_SERVER_PORT}${routePath}`;
};

const sortEntries = (
  a: { name: string; isDirectory: boolean },
  b: { name: string; isDirectory: boolean },
) => {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name.localeCompare(b.name);
};

const sendMenuAction = (action: string) => {
  mainWindow?.webContents.send('app:menu-action', action);
};

const buildEditMenu = (): Electron.MenuItemConstructorOptions => ({
  label: 'Edit',
  submenu: [
    {
      label: 'Undo',
      accelerator: 'CommandOrControl+Z',
      click: () => sendMenuAction('undo'),
    },
    {
      label: 'Redo',
      accelerator: 'CommandOrControl+Shift+Z',
      click: () => sendMenuAction('redo'),
    },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { type: 'separator' },
    {
      label: 'Find',
      accelerator: 'CommandOrControl+F',
      click: () => sendMenuAction('open-find'),
    },
    ...(process.platform === 'darwin'
      ? ([
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
        ] as Electron.MenuItemConstructorOptions[])
      : ([
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ] as Electron.MenuItemConstructorOptions[])),
  ],
});

const buildViewMenu = (): Electron.MenuItemConstructorOptions => ({
  label: 'View',
  submenu: [
    { role: 'reload' },
    { role: 'forceReload' },
    { role: 'toggleDevTools' },
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ],
});

const buildToolsMenu = (): Electron.MenuItemConstructorOptions => ({
  label: 'Tools',
  submenu: [
    {
      label: 'Zotero Preferences',
      click: () => sendMenuAction('zotero-preferences'),
    },
    {
      label: 'Zotero Refresh',
      click: () => sendMenuAction('zotero-refresh'),
    },
  ],
});

const buildApplicationMenu = () => {
  const settingsItem: Electron.MenuItemConstructorOptions = {
    label: 'Settings',
    accelerator: 'CommandOrControl+,',
    click: () => sendMenuAction('open-settings'),
  };

  const openProjectItem: Electron.MenuItemConstructorOptions = {
    label: 'Open Project',
    accelerator: 'CommandOrControl+O',
    click: () => sendMenuAction('open-project'),
  };

  const saveItem: Electron.MenuItemConstructorOptions = {
    label: 'Save',
    accelerator: 'CommandOrControl+S',
    click: () => sendMenuAction('save'),
  };

  const saveAsItem: Electron.MenuItemConstructorOptions = {
    label: 'Save As',
    accelerator: 'CommandOrControl+Shift+S',
    click: () => sendMenuAction('save-as'),
  };

  const closeTabItem: Electron.MenuItemConstructorOptions = {
    label: 'Close Tab',
    accelerator: 'CommandOrControl+W',
    click: () => sendMenuAction('close-tab'),
  };

  const editionMetadataItem: Electron.MenuItemConstructorOptions = {
    label: 'Edition metadata',
    click: () => sendMenuAction('edition-metadata'),
  };

  const checkSchemaUpdateItem: Electron.MenuItemConstructorOptions = {
    label: 'Check for schema updates',
    click: () => sendMenuAction('check-schema-update'),
  };

  const timeMachineItem: Electron.MenuItemConstructorOptions = {
    label: 'Time Machine',
    click: () => sendMenuAction('open-time-machine'),
  };

  const newFileItem: Electron.MenuItemConstructorOptions = {
    label: 'New File',
    accelerator: 'CommandOrControl+N',
    click: () => sendMenuAction('new-file'),
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: APP_NAME,
            submenu: [
              {
                label: `About ${APP_NAME}`,
                click: () => sendMenuAction('open-about'),
              },
              { type: 'separator' },
              settingsItem,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } satisfies Electron.MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'File',
      submenu: [
        newFileItem,
        saveItem,
        saveAsItem,
        closeTabItem,
        { type: 'separator' },
        openProjectItem,
        editionMetadataItem,
        checkSchemaUpdateItem,
        timeMachineItem,
        { type: 'separator' },
        ...(process.platform !== 'darwin'
          ? [
              {
                label: 'About Le Jean-Baptiste',
                click: () => sendMenuAction('open-about'),
              },
              { type: 'separator' },
            ]
          : []),
        process.platform === 'darwin'
          ? {
              label: 'Close Window',
              click: () => mainWindow?.close(),
            }
          : { role: 'quit' },
      ],
    },
    buildEditMenu(),
    buildToolsMenu(),
    buildViewMenu(),
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const setMainWindowTitle = (title?: string) => {
  mainWindow?.setTitle(title?.trim() ? title : APP_NAME);
};

const openProjectFromDialog = async () => {
  if (!mainWindow) return null;

  mainWindow.focus();

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Open project folder',
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  try {
    const bundle = await loadOrCreateProject(result.filePaths[0]);
    await writeLastProjectFile(bundle.projectFilePath);
    return bundle;
  } catch (error) {
    console.error('[crcao-desktop] openProject failed:', error);
    if (!mainWindow.isDestroyed()) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: APP_NAME,
        message: 'Could not open this project folder.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
};

const registerIpcHandlers = () => {
  ipcMain.handle('openProject', openProjectFromDialog);
  ipcMain.handle('openProjectFolder', openProjectFromDialog);

  ipcMain.handle('restoreLastProject', async () => {
    if (!(await getRememberWorkspaceOnStartup())) return null;
    const projectFilePath = await getValidLastProjectFile();
    if (!projectFilePath) return null;
    return loadProjectFile(projectFilePath);
  });

  ipcMain.handle('getRememberWorkspaceOnStartup', () => getRememberWorkspaceOnStartup());
  ipcMain.handle('setRememberWorkspaceOnStartup', (_event, remember: boolean) =>
    setRememberWorkspaceOnStartup(Boolean(remember)),
  );

  ipcMain.handle('saveWorkspaceSession', (_event, session: WorkspaceSession) =>
    saveWorkspaceSession(session),
  );

  ipcMain.handle('restoreWorkspaceSession', async () => {
    if (!(await getRememberWorkspaceOnStartup())) return null;

    const session = await getWorkspaceSession();
    const projectFilePath = session?.projectFilePath ?? (await getValidLastProjectFile());
    if (!projectFilePath) return null;

    const bundle = await loadProjectFile(projectFilePath);
    if (!bundle) return null;

    const openFilePaths: string[] = [];
    for (const filePath of session?.openFilePaths ?? []) {
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) openFilePaths.push(filePath);
      } catch {
        // File was moved or deleted since the last session.
      }
    }

    const activeFilePath =
      session?.activeFilePath && openFilePaths.includes(session.activeFilePath)
        ? session.activeFilePath
        : (openFilePaths[0] ?? null);

    const cursorPositions = Object.fromEntries(
      Object.entries(session?.cursorPositions ?? {}).filter(([filePath]) =>
        openFilePaths.includes(filePath),
      ),
    );

    return { activeFilePath, bundle, cursorPositions, openFilePaths };
  });

  ipcMain.handle(
    'readDirectory',
    async (_event, dirPath: string, options?: { allFiles?: boolean }) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((entry) => {
          if (entry.name.startsWith('.')) return false;
          if (options?.allFiles) return true;
          return entry.isDirectory() || entry.name.toLowerCase().endsWith('.xml');
        })
        .map((entry) => ({
          name: entry.name,
          path: path.join(dirPath, entry.name),
          isDirectory: entry.isDirectory(),
        }))
        .sort(sortEntries);
    },
  );

  ipcMain.handle('readFile', async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('writeFile', async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('statFile', async (_event, filePath: string) => {
    const stat = await fs.stat(filePath);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  });

  ipcMain.handle('syncWatchedFiles', (_event, paths: string[]) => {
    openFileWatcher?.sync(Array.isArray(paths) ? paths : []);
  });

  ipcMain.handle('ignoreFileChange', (_event, filePath: string, mtimeMs: number) => {
    openFileWatcher?.ignoreChange(filePath, mtimeMs);
  });

  ipcMain.handle('findXmlFilesByName', async (_event, rootPath: string, query: string) => {
    return findXmlFilesByName(rootPath, query);
  });

  ipcMain.handle('listProjectXmlFiles', async (_event, rootPath: string) => {
    return listProjectXmlFiles(rootPath);
  });

  ipcMain.handle('reloadProjectBundle', async (_event, projectFilePath: string) => {
    return loadProjectFile(projectFilePath);
  });

  ipcMain.handle(
    'installCatalogSchema',
    async (_event, projectFilePath: string, catalogId: string) => {
      return installCatalogSchema(projectFilePath, catalogId);
    },
  );

  ipcMain.handle(
    'installLocalSchema',
    async (_event, projectFilePath: string, rngPath: string, cssPath?: string | null) => {
      return installLocalSchema(projectFilePath, rngPath, cssPath);
    },
  );

  ipcMain.handle(
    'checkSchemaUpdate',
    async (_event, projectFilePath: string, options?: { force?: boolean }) => {
      return checkCatalogSchemaUpdate(projectFilePath, options);
    },
  );

  ipcMain.handle('applyCatalogSchemaUpdate', async (_event, projectFilePath: string) => {
    return applyCatalogSchemaUpdate(projectFilePath);
  });

  ipcMain.handle('timeMachine:listSnapshots', async (_event, projectRootPath: string) => {
    return listTimeMachineSnapshots(projectRootPath);
  });

  ipcMain.handle(
    'timeMachine:createSnapshot',
    async (_event, projectRootPath: string, projectName: string) => {
      return createTimeMachineSnapshot(projectRootPath, projectName);
    },
  );

  ipcMain.handle(
    'timeMachine:pickRestoreDestination',
    async (_event, projectRootPath: string, snapshotId: string) => {
      if (!mainWindow) return null;

      mainWindow.focus();
      const result = await dialog.showOpenDialog(mainWindow, {
        defaultPath: getDefaultTimeMachineRestorePath(projectRootPath, snapshotId),
        properties: ['openDirectory', 'createDirectory'],
        title: 'Choose restore destination',
      });

      if (result.canceled || !result.filePaths[0]) return null;
      return result.filePaths[0];
    },
  );

  ipcMain.handle(
    'timeMachine:restoreSnapshot',
    async (_event, snapshotPath: string, destinationPath: string) => {
      await restoreTimeMachineSnapshotToDirectory(snapshotPath, destinationPath);
    },
  );

  ipcMain.handle(
    'timeMachine:restoreSnapshotToProject',
    async (_event, projectRootPath: string, projectName: string, snapshotPath: string) => {
      return restoreTimeMachineSnapshotToProject(projectRootPath, projectName, snapshotPath);
    },
  );

  ipcMain.handle('pickSchemaFiles', async () => {
    const dialogParent = getTopNativeDialogWindow() ?? mainWindow;
    if (!dialogParent) return null;
    dialogParent.focus();
    const rngResult = await dialog.showOpenDialog(dialogParent, {
      properties: ['openFile'],
      filters: [{ name: 'RelaxNG schema', extensions: ['rng', 'rnc'] }],
      title: 'Choose schema file (.rng)',
    });
    if (rngResult.canceled || !rngResult.filePaths[0]) return null;

    const cssResult = await dialog.showOpenDialog(dialogParent, {
      properties: ['openFile'],
      filters: [{ name: 'CSS stylesheet', extensions: ['css'] }],
      title: 'Choose CSS file (optional)',
      message: 'Optional: choose a CSS file for this schema, or Cancel to skip.',
    });
    return {
      rngPath: rngResult.filePaths[0],
      cssPath: cssResult.canceled || !cssResult.filePaths[0] ? null : cssResult.filePaths[0],
    };
  });

  ipcMain.handle('createTempDocument', async (_event, content: string) => {
    const dir = path.join(app.getPath('temp'), 'le-jean-baptiste', `${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'untitled.xml');
    await fs.writeFile(filePath, content, 'utf-8');
    return { filePath, filename: 'untitled.xml' };
  });

  ipcMain.handle('getEncoderName', async () => getEncoderName());

  ipcMain.handle('setEncoderName', async (_event, name: string) => {
    await setEncoderName(name);
  });

  ipcMain.handle('getAiApiSettings', async () => getAiApiSettings());

  ipcMain.handle('setAiApiSettings', async (_event, settings: Partial<AiApiSettings>) => {
    await setAiApiSettings(settings);
  });

  ipcMain.handle('testAiConnection', async (_event, settings: Partial<AiApiSettings>) => {
    return testAiConnection(settings);
  });

  ipcMain.handle('generateAiTranslation', async (_event, request: AiTranslationRequest) => {
    return generateAiTranslation(request);
  });

  ipcMain.handle('zoteroCheckAvailability', async () => checkZoteroAvailability());

  ipcMain.handle('zoteroSearchItems', async (_event, query: string) => searchZoteroItems(query));

  ipcMain.handle('zoteroListStyles', async () => listZoteroStyles());

  ipcMain.handle('zoteroPickCitation', async () => pickZoteroCitationCayw());

  ipcMain.handle('zoteroCancelPick', async () => {
    cancelZoteroPick();
  });

  ipcMain.handle('renamePath', async (_event, oldPath: string, newPath: string) => {
    await renamePath(oldPath, newPath);
  });

  ipcMain.handle('movePath', async (_event, sourcePath: string, destDir: string) => {
    return movePath(sourcePath, destDir);
  });

  ipcMain.handle('deletePath', async (_event, targetPath: string) => {
    await deletePath(targetPath);
  });

  ipcMain.handle('createDirectory', async (_event, parentDir: string, folderName: string) => {
    return createDirectory(parentDir, folderName);
  });

  ipcMain.handle('pickMoveDestination', async (_event, defaultDir?: string) => {
    if (!mainWindow) return null;

    mainWindow.focus();
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: defaultDir,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('saveFileAs', async (_event, defaultPath?: string) => {
    if (!mainWindow) return null;

    mainWindow.focus();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'XML Documents', extensions: ['xml'] }],
    });

    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle('setWindowTitle', (_event, title: string) => {
    setMainWindowTitle(title);
  });

  ipcMain.handle('window-minimize', () => mainWindow?.minimize());
  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window-close', () => mainWindow?.close());
  ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);
};

const createWindow = async () => {
  const icon = getAppIcon();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon,
    title: APP_NAME,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 12, y: 10 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window-maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-maximized', false));

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    setMainWindowTitle(APP_NAME);
    prewarmNativeDialog('projectMetadata');
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isFindShortcut =
      input.type === 'keyDown' &&
      (input.meta || input.control) &&
      !input.shift &&
      !input.alt &&
      input.key?.toLowerCase() === 'f';

    if (!isFindShortcut) return;

    event.preventDefault();
    sendMenuAction('open-find');
  });

  try {
    const url = await getAppUrl();
    await mainWindow.loadURL(url);
  } catch (error) {
    console.error('[crcao-desktop] Failed to load app URL:', error);
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: APP_NAME,
      message: 'Could not connect to the LEAF-Writer dev server.',
      detail:
        'Make sure leafwriter-commons is running on port 3000, then restart the desktop app.\n\nFrom the repo root: npm run dev -w leafwriter-commons',
    });
    app.quit();
    return;
  }

  if (isDev && process.env.CRCAO_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    openFileWatcher?.dispose();
    openFileWatcher = null;
    closeAllNativeDialogs();
    disposeLemminx();
    mainWindow = null;
  });

  openFileWatcher = new OpenFileWatcher(() => mainWindow);
};

initNativeDialogs({
  getAppUrl,
  getParentWindow: () => mainWindow,
  getAppIcon,
  getPreloadPath: () => path.join(__dirname, 'preload.js'),
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const icon = getAppIcon();
    if (icon) app.dock?.setIcon(icon);
  }

  buildApplicationMenu();
  registerCrcaoProtocol();
  registerIpcHandlers();
  registerNativeDialogIpc();
  registerLemminxIpc(() => mainWindow);
  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  disposeLemminx();
  if (process.platform !== 'darwin') app.quit();
});
