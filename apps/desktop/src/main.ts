import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
  Notification,
  protocol,
  shell,
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
  buildTranslationRequestBody,
  isStructuredOutputRetryable,
  translationStructuredOutputModes,
  type StructuredOutputMode,
} from './aiTranslationLlm';
import {
  getAiApiSettings,
  getEncoderName,
  getEntityDbFolder,
  getRememberWorkspaceOnStartup,
  getValidLastProjectFile,
  getWorkspaceSession,
  saveWorkspaceSession,
  setAiApiSettings,
  setEncoderName,
  setEntityDbFolder,
  setRememberWorkspaceOnStartup,
  writeLastProjectFile,
  type AiApiSettings,
  type WorkspaceSession,
} from './projectPrefs';
import {
  AUTHORITY_DB_DIRNAME,
  downloadAuthoritySource,
  getAuthorityStatuses,
  type AuthoritySourceId,
} from './authorityDatabases';
import {
  getAuthorityPackStatuses,
  installAuthorityPacksFrom,
  readAuthorityPackFile,
} from './authorityPacks';
import {
  getAuthorityLifecycleStatus,
  maybeCheckAuthorityUpdates,
  readLifecycleConfig,
  recordDeclinedFirstPrompt,
  runAuthorityLifecyclePipeline,
  setAuthorityLifecycleEnabled,
} from './authorityLifecycle';
import { getChgisStatus, installChgisFromArchive, removeChgisData } from './authorityChgis';
import { loadOrCreateProject, loadProjectFile, writeProjectConfig } from './projectFile';
import mammoth from 'mammoth';
import { extractOdtText } from './odtText';
import { decodeTextBuffer } from './textEncoding';
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
import { ensureSanmiaoDatesSchemaMerged } from './sanmiaoSchemaMerge';
import { applyCatalogSchemaUpdate, checkCatalogSchemaUpdate } from './checkSchemaUpdate';
import {
  createTimeMachineSnapshot,
  getDefaultTimeMachineRestorePath,
  listTimeMachineSnapshots,
  restoreTimeMachineSnapshotToProject,
  restoreTimeMachineSnapshotToDirectory,
} from './timeMachine';
import {
  sanmiaoListDateAuthority,
  sanmiaoProposeDates,
  sanmiaoProposeDatesBatch,
  sanmiaoResolveDatesBatch,
  sanmiaoTagDatesBatch,
  type SanmiaoProposeOptions,
} from './sanmiaoBridge';

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

type ImportableDocumentFormat = 'txt' | 'md' | 'rtf' | 'docx' | 'odt';

interface DocumentImportSource {
  format: ImportableDocumentFormat;
  relativePath: string;
  sourcePath: string;
}

const getImportableDocumentFormat = (filePath: string): ImportableDocumentFormat | null => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.txt') return 'txt';
  if (extension === '.md' || extension === '.markdown') return 'md';
  if (extension === '.rtf') return 'rtf';
  if (extension === '.docx') return 'docx';
  if (extension === '.odt') return 'odt';
  return null;
};

const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};
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

const aiTranslationDebugLogPath = (): string =>
  path.join(app.getPath('userData'), 'ai-translation-debug.jsonl');

/** Appends one JSON line per AI translation attempt so failures (e.g. malformed or
 * truncated XML) can be diagnosed from the raw response after the fact. */
const logAiTranslationDebug = async (entry: Record<string, unknown>): Promise<void> => {
  try {
    await fs.appendFile(
      aiTranslationDebugLogPath(),
      JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n',
      'utf8',
    );
  } catch (error) {
    console.error('[le-jean-baptiste] Failed to write AI translation debug log:', error);
  }
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

const postAiTranslation = async (
  baseUrl: string,
  settings: AiApiSettings,
  request: AiTranslationRequest,
  model: string,
  signal: AbortSignal,
  mode: StructuredOutputMode,
): Promise<Response> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;

  return fetch(`${baseUrl}/chat/completions`, {
    body: JSON.stringify(buildTranslationRequestBody(model, settings, request, baseUrl, mode)),
    headers,
    method: 'POST',
    signal,
  });
};

const postAiTranslationWithStructuredOutputFallback = async (
  baseUrl: string,
  settings: AiApiSettings,
  request: AiTranslationRequest,
  model: string,
  signal: AbortSignal,
): Promise<Response> => {
  const modes = translationStructuredOutputModes(baseUrl);
  let response = await postAiTranslation(baseUrl, settings, request, model, signal, modes[0]!);

  if (!response.ok) {
    let error = await readErrorResponse(response.clone());
    for (let i = 1; i < modes.length; i++) {
      if (!isStructuredOutputRetryable(response.status, error)) break;
      response = await postAiTranslation(baseUrl, settings, request, model, signal, modes[i]!);
      if (response.ok) break;
      error = await readErrorResponse(response.clone());
    }
  }

  return response;
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
    let response = await postAiTranslationWithStructuredOutputFallback(
      baseUrl,
      settings,
      request,
      model,
      controller.signal,
    );

    if (response.status === 404 && settings.model.trim()) {
      const models = await listAiModels(settings).catch(() => []);
      const fallbackModel = models.find((candidate) => candidate !== model);
      if (fallbackModel) {
        response = await postAiTranslationWithStructuredOutputFallback(
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
      choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }>;
      usage?: unknown;
    };
    const choice = body.choices?.[0];
    const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : null;
    const content = choice?.message?.content;
    const debugBase = {
      model,
      finishReason,
      usage: body.usage ?? null,
      sourceUnitXmlLength: sourceUnitXml.length,
      contentLength: typeof content === 'string' ? content.length : null,
      rawContent: typeof content === 'string' ? content : null,
    };

    if (typeof content !== 'string') {
      await logAiTranslationDebug({ ...debugBase, outcome: 'no-message-content' });
      return { ok: false, error: 'AI response did not include message content.' };
    }

    if (finishReason === 'length') {
      await logAiTranslationDebug({ ...debugBase, outcome: 'truncated' });
      return {
        ok: false,
        error:
          'AI response was cut off by the token limit (finish_reason=length) — the passage is too long for the model settings.',
      };
    }

    const translationXml = parseTranslationXmlFromResponse(content);
    if (!translationXml) {
      await logAiTranslationDebug({ ...debugBase, outcome: 'no-translation-xml' });
      return { ok: false, error: 'AI response did not include translationXml.' };
    }

    await logAiTranslationDebug({
      ...debugBase,
      outcome: 'ok',
      translationXmlLength: translationXml.length,
    });
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
    scheme: 'ljb',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const registerLjbProtocol = () => {
  protocol.registerFileProtocol('ljb', (request, callback) => {
    try {
      const filePath = decodeURIComponent(request.url.slice('ljb://'.length));
      callback({ path: path.normalize(filePath) });
    } catch {
      callback({ error: -2 });
    }
  });
};

const isDev = !app.isPackaged;
const DEV_COMMONS_URL = process.env.COMMONS_URL ?? 'http://localhost:3000';
const PROD_SERVER_PORT = process.env.LJB_SERVER_PORT ?? '3847';
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

const collectImportSourcesFromPath = async (
  entryPath: string,
  rootPath = entryPath,
): Promise<DocumentImportSource[]> => {
  const stat = await fs.stat(entryPath);

  if (stat.isFile()) {
    const format = getImportableDocumentFormat(entryPath);
    if (!format) return [];

    return [
      {
        format,
        relativePath:
          rootPath === entryPath
            ? path.basename(entryPath)
            : path.relative(rootPath, entryPath) || path.basename(entryPath),
        sourcePath: entryPath,
      },
    ];
  }

  if (!stat.isDirectory()) return [];

  const entries = await fs.readdir(entryPath, { withFileTypes: true });
  const collected = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => collectImportSourcesFromPath(path.join(entryPath, entry.name), rootPath)),
  );

  return collected.flat();
};

const sendMenuAction = (action: string) => {
  mainWindow?.webContents.send('app:menu-action', action);
};

const isMainWindowLive = (): boolean => mainWindow !== null && !mainWindow.isDestroyed();

const waitForMainWindowLoad = (window: BrowserWindow): Promise<void> =>
  new Promise((resolve) => {
    if (window.webContents.isLoading()) {
      window.webContents.once('did-finish-load', () => resolve());
      return;
    }
    resolve();
  });

let pendingRendererReadyResolvers: Array<() => void> = [];

const waitForRendererReady = (timeoutMs = 10_000): Promise<void> =>
  new Promise((resolve, reject) => {
    const onReady = () => {
      clearTimeout(timeout);
      resolve();
    };

    const timeout = setTimeout(() => {
      const index = pendingRendererReadyResolvers.indexOf(onReady);
      if (index >= 0) pendingRendererReadyResolvers.splice(index, 1);
      reject(new Error('Timed out waiting for renderer'));
    }, timeoutMs);

    pendingRendererReadyResolvers.push(onReady);
  });

const ensureMainWindowReady = async (): Promise<BrowserWindow | null> => {
  if (isMainWindowLive()) {
    await waitForMainWindowLoad(mainWindow!);
    mainWindow!.focus();
    return mainWindow;
  }

  await createWindow();
  if (!isMainWindowLive()) return null;

  await waitForMainWindowLoad(mainWindow!);
  mainWindow!.focus();
  return mainWindow;
};

const handleOpenProjectMenu = async () => {
  const reopening = !isMainWindowLive();
  if (!(await ensureMainWindowReady())) return;

  if (reopening) {
    try {
      await waitForRendererReady();
      await new Promise<void>((resolve) => setImmediate(resolve));
    } catch (error) {
      console.error('[le-jean-baptiste] Renderer not ready for open project:', error);
      return;
    }
  }

  sendMenuAction('open-project');
};

const menuSeparator = (): Electron.MenuItemConstructorOptions => ({ type: 'separator' });

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
    menuSeparator(),
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    menuSeparator(),
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
          menuSeparator(),
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
    menuSeparator(),
    {
      label: 'Actual Size',
      accelerator: 'CommandOrControl+0',
      click: () => sendMenuAction('editor-zoom-reset'),
    },
    {
      label: 'Zoom In',
      accelerator: 'CommandOrControl+Plus',
      click: () => sendMenuAction('editor-zoom-in'),
    },
    {
      // Hidden twin so the unshifted =/+ key also zooms in, like the built-in role.
      label: 'Zoom In (hidden)',
      accelerator: 'CommandOrControl+=',
      visible: false,
      acceleratorWorksWhenHidden: true,
      click: () => sendMenuAction('editor-zoom-in'),
    },
    {
      label: 'Zoom Out',
      accelerator: 'CommandOrControl+-',
      click: () => sendMenuAction('editor-zoom-out'),
    },
    menuSeparator(),
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

const buildHelpMenu = (): Electron.MenuItemConstructorOptions => ({
  label: 'Help',
  submenu: [
    {
      label: 'Documentation',
      click: () => sendMenuAction('open-documentation'),
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
    click: () => {
      void handleOpenProjectMenu();
    },
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
    label: 'Project settings',
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

  const importDocumentsItem: Electron.MenuItemConstructorOptions = {
    label: 'Import Documents',
    click: () => sendMenuAction('import-documents'),
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
              menuSeparator(),
              settingsItem,
              menuSeparator(),
              { role: 'services' },
              menuSeparator(),
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              menuSeparator(),
              { role: 'quit' },
            ],
          } satisfies Electron.MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'File',
      submenu: [
        newFileItem,
        importDocumentsItem,
        saveItem,
        saveAsItem,
        closeTabItem,
        menuSeparator(),
        openProjectItem,
        editionMetadataItem,
        checkSchemaUpdateItem,
        timeMachineItem,
        menuSeparator(),
        ...(process.platform !== 'darwin'
          ? [
              settingsItem,
              menuSeparator(),
              {
                label: 'About Le Jean-Baptiste',
                click: () => sendMenuAction('open-about'),
              },
              menuSeparator(),
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
    buildHelpMenu(),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const setMainWindowTitle = (title?: string) => {
  mainWindow?.setTitle(title?.trim() ? title : APP_NAME);
};

const openProjectFromDialog = async () => {
  if (!mainWindow) {
    await createWindow();
    if (!mainWindow) return null;
  }

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
    console.error('[le-jean-baptiste] openProject failed:', error);
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
  ipcMain.handle('signalRendererReady', () => {
    const resolvers = [...pendingRendererReadyResolvers];
    pendingRendererReadyResolvers.length = 0;
    resolvers.forEach((resolve) => resolve());
  });

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

  ipcMain.handle('readFileAutoEncoding', async (_event, filePath: string) => {
    return decodeTextBuffer(await fs.readFile(filePath));
  });

  ipcMain.handle(
    'writeClipboardRich',
    (_event, flavors: { text: string; html?: string; rtf?: string }) => {
      clipboard.write({
        text: flavors.text,
        ...(flavors.html ? { html: flavors.html } : {}),
        ...(flavors.rtf ? { rtf: flavors.rtf } : {}),
      });
    },
  );

  ipcMain.handle('extractOdtText', async (_event, filePath: string) => {
    return extractOdtText(filePath);
  });

  ipcMain.handle('extractDocxText', async (_event, filePath: string) => {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value,
      warnings: result.messages.map((message) => message.message),
    };
  });

  ipcMain.handle('writeFile', async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('pathExists', async (_event, filePath: string) => {
    return pathExists(filePath);
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

  ipcMain.handle('ensureSanmiaoDatesSchema', async (_event, projectFilePath: string) => {
    const bundle = await loadProjectFile(projectFilePath);
    if (!bundle) return { merged: false };
    const merged = await ensureSanmiaoDatesSchemaMerged(bundle);
    return { merged };
  });

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

  ipcMain.handle('pickDocumentImportSources', async () => {
    if (!mainWindow) return null;

    mainWindow.focus();
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [
        {
          name: 'Importable documents',
          extensions: ['txt', 'md', 'markdown', 'rtf', 'docx', 'odt'],
        },
        { name: 'All files', extensions: ['*'] },
      ],
      message: 'Choose text, Markdown, RTF files, or folders to import.',
      properties: ['openFile', 'openDirectory', 'multiSelections'],
      title: 'Import documents',
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const collected = await Promise.all(
      result.filePaths.map((filePath) => collectImportSourcesFromPath(filePath)),
    );

    return collected.flat().sort((a, b) => a.relativePath.localeCompare(b.relativePath));
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

  ipcMain.handle('getEntityDbFolder', async () => getEntityDbFolder());

  const getAuthorityDbDir = async (): Promise<string | null> => {
    const folder = await getEntityDbFolder();
    return folder?.trim() ? path.join(folder, AUTHORITY_DB_DIRNAME) : null;
  };

  ipcMain.handle('authorityDb:statuses', async () =>
    getAuthorityStatuses(await getAuthorityDbDir()),
  );

  const activeAuthorityDownloads = new Set<AuthoritySourceId>();

  ipcMain.handle('authorityDb:download', async (event, sourceId: AuthoritySourceId) => {
    const baseDir = await getAuthorityDbDir();
    if (!baseDir) return { ok: false, error: 'No entity database folder configured.' };
    if (activeAuthorityDownloads.has(sourceId)) {
      return { ok: false, error: 'Download already in progress.' };
    }

    activeAuthorityDownloads.add(sourceId);
    // Throttle progress events: these fire per network chunk.
    let lastSent = 0;
    try {
      const manifest = await downloadAuthoritySource(baseDir, sourceId, (progress) => {
        const now = Date.now();
        if (now - lastSent < 250) return;
        lastSent = now;
        if (!event.sender.isDestroyed()) event.sender.send('authorityDb:progress', progress);
      });
      new Notification({
        title: 'Authority database installed',
        body: `${sourceId.toUpperCase()} ${manifest.version} is ready to use.`,
      }).show();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notification({
        title: 'Authority database download failed',
        body: `${sourceId.toUpperCase()}: ${message}`,
      }).show();
      return { ok: false, error: message };
    } finally {
      activeAuthorityDownloads.delete(sourceId);
    }
  });

  ipcMain.handle('authorityDb:promptDownload', async () => {
    if (!mainWindow) return 'declined';

    // A past decline is remembered so the user isn't nagged on every project
    // open; downloads stay available from the authority UI later.
    const baseDir = await getAuthorityDbDir();
    if (!baseDir) return 'declined';
    const declinedMarker = path.join(baseDir, 'download-declined.json');
    if (existsSync(declinedMarker)) return 'declined';

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Download', 'Not now'],
      defaultId: 0,
      cancelId: 1,
      message: 'Download Chinese authority databases?',
      detail:
        'This project uses Chinese as its source language. LEAF-Writer can download ' +
        'CBDB (China Biographical Database, ~600 MB) and the DILA Buddhist Studies ' +
        'authorities (~85 MB), plus compiled Wikidata packs, for automated tagging. They are stored next to your ' +
        'central entity database and download in the background.',
    });
    if (result.response !== 0) {
      await fs.mkdir(baseDir, { recursive: true });
      await fs.writeFile(
        declinedMarker,
        JSON.stringify({ declinedAt: new Date().toISOString() }, null, 2),
        'utf-8',
      );
      return 'declined';
    }
    return 'accepted';
  });

  const getEntityDbFolderOrNull = async () => {
    const folder = await getEntityDbFolder();
    return folder?.trim() ? folder : null;
  };

  ipcMain.handle('authorityPack:statuses', async () => {
    const folder = await getEntityDbFolderOrNull();
    if (!folder) return [];
    return getAuthorityPackStatuses(folder);
  });

  ipcMain.handle('authorityPack:read', async (_event, packId: string) => {
    const folder = await getEntityDbFolderOrNull();
    if (!folder) throw new Error('No entity database folder configured.');
    return readAuthorityPackFile(
      folder,
      packId as import('../../commons/src/desktop/authorityPackTypes').AuthorityPackId,
    );
  });

  ipcMain.handle(
    'sanmiao:proposeDates',
    async (_event, text: string, options?: SanmiaoProposeOptions) =>
      sanmiaoProposeDates(text, options ?? {}),
  );

  ipcMain.handle(
    'sanmiao:proposeDatesBatch',
    async (event, chunks: string[], options?: SanmiaoProposeOptions) =>
      sanmiaoProposeDatesBatch(chunks, options ?? {}, (progress) => {
        event.sender.send('sanmiao:progress', progress);
      }),
  );

  ipcMain.handle(
    'sanmiao:tagDatesBatch',
    async (event, chunks: string[], options?: SanmiaoProposeOptions) =>
      sanmiaoTagDatesBatch(chunks, options ?? {}, (progress) => {
        event.sender.send('sanmiao:progress', progress);
      }),
  );

  ipcMain.handle(
    'sanmiao:resolveDatesBatch',
    async (event, dates: string[], options?: SanmiaoProposeOptions) =>
      sanmiaoResolveDatesBatch(dates, options ?? {}, (progress) => {
        event.sender.send('sanmiao:progress', progress);
      }),
  );

  ipcMain.handle('sanmiao:listDateAuthority', async (_event, options?: SanmiaoProposeOptions) =>
    sanmiaoListDateAuthority(options ?? {}),
  );

  ipcMain.handle('authorityPack:installFrom', async (_event, sourcePacksRoot: string) => {
    const folder = await getEntityDbFolderOrNull();
    if (!folder) return { ok: false, error: 'No entity database folder configured.' };
    try {
      const { copied } = await installAuthorityPacksFrom(sourcePacksRoot, folder);
      return { ok: true, copied };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const emitAuthorityLifecycleProgress = (
    event: Electron.IpcMainInvokeEvent,
    progress: import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleProgress,
  ) => {
    if (!event.sender.isDestroyed()) event.sender.send('authorityLifecycle:progress', progress);
  };

  ipcMain.handle('authorityLifecycle:get', async () => {
    const folder = await getEntityDbFolderOrNull();
    return getAuthorityLifecycleStatus(folder);
  });

  ipcMain.handle('authorityLifecycle:maybeCheckUpdates', async () => {
    const folder = await getEntityDbFolderOrNull();
    return maybeCheckAuthorityUpdates(folder);
  });

  ipcMain.handle('authorityLifecycle:revealFolder', async () => {
    const folder = await getEntityDbFolderOrNull();
    if (!folder) return false;
    shell.showItemInFolder(path.join(folder, 'entities.xml'));
    return true;
  });

  ipcMain.handle(
    'authorityLifecycle:setEnabled',
    async (
      event,
      options: import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleSetEnabledOptions,
    ) => {
      const folder = await getEntityDbFolderOrNull();
      const result = await setAuthorityLifecycleEnabled(folder, options, (progress) =>
        emitAuthorityLifecycleProgress(event, progress),
      );
      if (result.ok && options.enabled) {
        const label =
          options.profile === 'japanese'
            ? 'NDL and Wikidata tagging packs'
            : options.profile === 'tibetan'
              ? 'Wikidata tagging packs'
              : 'CBDB, DILA, and Wikidata tagging packs';
        new Notification({
          title: 'Offline authorities ready',
          body: `${label} were installed from the registry.`,
        }).show();
      } else if (!result.ok) {
        new Notification({
          title: 'Authority setup failed',
          body: result.error ?? 'Could not download or compile authority data.',
        }).show();
      }
      return result;
    },
  );

  ipcMain.handle('authorityLifecycle:update', async (event) => {
    const folder = await getEntityDbFolderOrNull();
    if (!folder) return { ok: false, error: 'No entity database folder configured.' };
    const lifecycle = await readLifecycleConfig(folder);
    const result = await runAuthorityLifecyclePipeline({
      entityDbFolder: folder,
      profile: lifecycle.profile,
      forceDownload: false,
      onProgress: (progress) => emitAuthorityLifecycleProgress(event, progress),
    });
    if (result.ok) {
      const label =
        lifecycle.profile === 'japanese'
          ? 'NDL and Wikidata tagging packs'
          : lifecycle.profile === 'tibetan'
            ? 'Wikidata tagging packs'
            : 'CBDB, DILA, and Wikidata tagging packs';
      new Notification({
        title: 'Authority data updated',
        body: `${label} were refreshed from the registry.`,
      }).show();
    } else {
      new Notification({
        title: 'Authority update failed',
        body: result.error ?? 'Update could not complete.',
      }).show();
    }
    return result;
  });

  ipcMain.handle('authorityLifecycle:promptEnable', async (_event, profile = 'chinese') => {
    if (!mainWindow) return 'declined';

    const folder = await getEntityDbFolderOrNull();
    if (!folder) return 'declined';

    const lifecycle = await readLifecycleConfig(folder);
    if (lifecycle.enabled && lifecycle.profile === profile) return 'declined';
    if (lifecycle.declinedFirstPrompt && lifecycle.profile === profile) return 'declined';

    const legacyDeclined = path.join(folder, AUTHORITY_DB_DIRNAME, 'download-declined.json');
    if (existsSync(legacyDeclined)) {
      await recordDeclinedFirstPrompt(folder, profile);
      return 'declined';
    }

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Download', 'Not now'],
      defaultId: 0,
      cancelId: 1,
      message:
        profile === 'japanese'
          ? 'Download Japanese authority packs?'
          : profile === 'tibetan'
            ? 'Download Tibetan authority packs?'
            : 'Download Chinese authority databases?',
      detail:
        profile === 'japanese'
          ? 'This project uses Japanese as its source language. LEAF-Writer can download NDL and Wikidata authority packs for automated tagging. They are stored next to your central entity database.'
          : profile === 'tibetan'
            ? 'This project uses Tibetan as its source language. LEAF-Writer can download Wikidata authority packs for automated tagging. They are stored next to your central entity database.'
            : 'This project uses Chinese as its source language. LEAF-Writer can download CBDB (China Biographical Database, ~600 MB), the DILA Buddhist Studies authorities (~85 MB), and Wikidata authority packs for automated tagging. They are stored next to your central entity database.',
    });
    if (result.response !== 0) {
      await recordDeclinedFirstPrompt(folder, profile);
      return 'declined';
    }
    return 'accepted';
  });

  const emitChgisProgress = (
    event: Electron.IpcMainInvokeEvent,
    progress: import('../../commons/src/desktop/authorityChgisTypes').ChgisInstallProgress,
  ) => {
    if (!event.sender.isDestroyed()) event.sender.send('authorityChgis:progress', progress);
  };

  ipcMain.handle('authorityChgis:get', async () => {
    const folder = await getEntityDbFolderOrNull();
    return getChgisStatus(folder);
  });

  ipcMain.handle('pickChgisArchive', async () => {
    const parent = getTopNativeDialogWindow() ?? mainWindow ?? undefined;
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'openDirectory'],
      title: 'Choose CHGIS download',
      message: 'Select a .zip from Harvard Dataverse, an unzipped layer folder, or a .shp file.',
      filters: [
        { name: 'CHGIS archives', extensions: ['zip'] },
        { name: 'Shapefiles', extensions: ['shp'] },
        { name: 'All files', extensions: ['*'] },
      ],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle('authorityChgis:installFromArchive', async (event, archivePath: string) => {
    const folder = await getEntityDbFolderOrNull();
    if (!folder) return { ok: false, error: 'No entity database folder configured.' };
    if (!mainWindow) {
      return { ok: false, error: 'Install dialog is unavailable.' };
    }

    const license = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Accept and install', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'CHGIS academic license',
      message: 'Install CHGIS historical place data?',
      detail:
        'CHGIS is free for academic research. Commercial use, resale, and redistribution are not permitted.\n\nYou must have downloaded the data yourself from Harvard Dataverse. LEAF-Writer will compile a local tagging pack on your machine only.',
    });
    if (license.response !== 0) return { ok: false, error: 'Install cancelled.' };

    const result = await installChgisFromArchive({
      entityDbFolder: folder,
      archivePath,
      onProgress: (progress) => emitChgisProgress(event, progress),
    });
    if (result.ok) {
      new Notification({
        title: 'CHGIS places ready',
        body: `Compiled ${result.placeCount?.toLocaleString() ?? ''} historical places for auto-tagging.`,
      }).show();
    } else {
      new Notification({
        title: 'CHGIS install failed',
        body: result.error ?? 'Compile could not complete.',
      }).show();
    }
    return result;
  });

  ipcMain.handle('authorityChgis:remove', async () => {
    const folder = await getEntityDbFolderOrNull();
    if (!folder) return { ok: false, error: 'No entity database folder configured.' };
    await removeChgisData(folder);
    return { ok: true };
  });

  ipcMain.handle('setEntityDbFolder', async (_event, folder: string | null) => {
    await setEntityDbFolder(folder);
  });

  ipcMain.handle('pickEntityDbFolder', async () => {
    const parent = getTopNativeDialogWindow() ?? mainWindow ?? undefined;
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose entity database folder',
      message:
        'This folder will hold your entity database (entities.xml). You can keep your projects here too.',
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle('pickAuthorityPacksSource', async () => {
    const parent = getTopNativeDialogWindow() ?? mainWindow ?? undefined;
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory'],
      title: 'Choose compiled authority packs folder',
      message: 'Select the folder that contains cbdb/ and dila/ (e.g. authority extraction/packs).',
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(
    'updateProjectFileConfig',
    async (_event, projectFilePath: string, patch: Record<string, unknown>) =>
      writeProjectConfig(projectFilePath, patch),
  );

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

  ipcMain.handle('ensureDirectory', async (_event, dirPath: string) => {
    await fs.mkdir(dirPath, { recursive: true });
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

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window-close', () => mainWindow?.close());
  ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);
};

const createWindow = async () => {
  if (isMainWindowLive()) return;

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
    console.error('[le-jean-baptiste] Failed to load app URL:', error);
    const message = isDev
      ? 'Could not connect to the LEAF-Writer dev server.'
      : 'Could not start the bundled LEAF-Writer server.';
    const detail = isDev
      ? 'Make sure leafwriter-commons is running on port 3000, then restart the desktop app.\n\nFrom the repo root: npm run dev -w leafwriter-commons'
      : 'The packaged app could not start its bundled server. Quit the app and open it again. If the problem persists, rebuild the DMG and make sure the app was copied fully out of the disk image.';
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: APP_NAME,
      message,
      detail,
    });
    app.quit();
    return;
  }

  if (isDev && process.env.LJB_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    openFileWatcher?.dispose();
    openFileWatcher = null;
    closeAllNativeDialogs();
    disposeLemminx();
    pendingRendererReadyResolvers.length = 0;
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
  registerLjbProtocol();
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
