import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron';
import { fork, type ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

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

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

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

const getAppUrl = async (): Promise<string> => {
  if (isDev) {
    await waitForDevCommons();
    return `${DEV_COMMONS_URL}/project`;
  }
  await startCommonsServer();
  return `http://127.0.0.1:${PROD_SERVER_PORT}/project`;
};

const sortEntries = (
  a: { name: string; isDirectory: boolean },
  b: { name: string; isDirectory: boolean },
) => {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name.localeCompare(b.name);
};

const registerIpcHandlers = () => {
  ipcMain.handle('openProjectFolder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return { rootPath: result.filePaths[0] };
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
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'CRCAO Editor',
  });

  try {
    const url = await getAppUrl();
    await mainWindow.loadURL(url);
  } catch (error) {
    console.error('[crcao-desktop] Failed to load app URL:', error);
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'CRCAO Editor',
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
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  registerCrcaoProtocol();
  registerIpcHandlers();
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
