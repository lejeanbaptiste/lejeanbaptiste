import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, protocol, systemPreferences } from 'electron';
import { fork, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import {
  closeAllNativeDialogs,
  initNativeDialogs,
  registerNativeDialogIpc,
} from './nativeDialogs';
import { getValidLastProjectFile, writeLastProjectFile } from './projectPrefs';
import { loadOrCreateProject, loadProjectFile } from './projectFile';
import {
  createDirectory,
  deletePath,
  findXmlFilesByName,
  movePath,
  renamePath,
} from './explorerFileOps';
import { OpenFileWatcher } from './openFileWatcher';

const APP_NAME = 'Le Jean-Baptiste';

// Hide macOS-injected Edit menu items (Emoji & Symbols, Start Dictation).
if (process.platform === 'darwin') {
  systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true);
  systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true);
}

// Must run before app.ready so macOS uses this name in the menu bar (dev and packaged).
app.setName(APP_NAME);

const getIconPath = () => {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '../../../design');
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
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { type: 'separator' },
    {
      label: 'Find…',
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

const buildApplicationMenu = () => {
  const settingsItem: Electron.MenuItemConstructorOptions = {
    label: 'Settings…',
    accelerator: 'CommandOrControl+,',
    click: () => sendMenuAction('open-settings'),
  };

  const openProjectItem: Electron.MenuItemConstructorOptions = {
    label: 'Open Project…',
    accelerator: 'CommandOrControl+O',
    click: () => sendMenuAction('open-project'),
  };

  const saveItem: Electron.MenuItemConstructorOptions = {
    label: 'Save',
    accelerator: 'CommandOrControl+S',
    click: () => sendMenuAction('save'),
  };

  const saveAsItem: Electron.MenuItemConstructorOptions = {
    label: 'Save As…',
    accelerator: 'CommandOrControl+Shift+S',
    click: () => sendMenuAction('save-as'),
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
        openProjectItem,
        { type: 'separator' },
        saveItem,
        saveAsItem,
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
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    buildEditMenu(),
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
    const projectFilePath = await getValidLastProjectFile();
    if (!projectFilePath) return null;
    return loadProjectFile(projectFilePath);
  });

  ipcMain.handle(
    'readDirectory',
    async (_event, dirPath: string, options?: { allFiles?: boolean }) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((entry) => {
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
};

const createWindow = async () => {
  const icon = getAppIcon();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon,
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    setMainWindowTitle(APP_NAME);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isFindShortcut =
      input.type === 'keyDown' &&
      (input.meta || input.control) &&
      !input.shift &&
      !input.alt &&
      (input.code === 'KeyF' || input.key?.toLowerCase() === 'f');

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
  if (process.platform !== 'darwin') app.quit();
});
