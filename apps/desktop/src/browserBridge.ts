import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';

export const NATIVE_HOST_NAME = 'org.lejeanbaptiste.import';
/** Pinned unpacked-extension id (see apps/browser-extension/manifest.json key). */
export const BROWSER_EXTENSION_ID = 'dddnkaleimllefhfolmhdfbidnjfojjh';

export interface WikisourceImportOrder {
  v?: number;
  action: 'import-wikisource';
  wiki: string;
  title: string;
  url: string;
  scope: 'page' | 'work';
}

export interface KanripoImportOrder {
  v?: number;
  action: 'import-kanripo';
  kr_id: string;
  url: string;
  scope: 'work' | 'juan';
  juan?: string;
  loc?: string;
}

export interface BdrcImportOrder {
  v?: number;
  action: 'import-bdrc';
  /** `VE…` volume id or `UT…` etext id from the reader's `openEtext` param. */
  etext_id: string;
  url: string;
  scope: 'volume';
}

export type BrowserImportOrder = WikisourceImportOrder | KanripoImportOrder | BdrcImportOrder;

const isWikisourceOrder = (payload: BrowserImportOrder): payload is WikisourceImportOrder =>
  payload?.action === 'import-wikisource';

const isKanripoOrder = (payload: BrowserImportOrder): payload is KanripoImportOrder =>
  payload?.action === 'import-kanripo';

const isBdrcOrder = (payload: BrowserImportOrder): payload is BdrcImportOrder =>
  payload?.action === 'import-bdrc';

const pointerPath = (): string =>
  path.join(os.homedir(), '.config', 'lejeanbaptiste', 'browser-bridge.json');

const nativeMessagingDirs = (): string[] => {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    const appSupport = path.join(home, 'Library', 'Application Support');
    return [
      path.join(appSupport, 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
      path.join(appSupport, 'Google', 'Chrome', 'NativeMessagingHosts'),
      path.join(appSupport, 'Chromium', 'NativeMessagingHosts'),
      path.join(appSupport, 'Microsoft Edge', 'NativeMessagingHosts'),
    ];
  }
  // Linux (XDG). Windows registers via the registry — not handled here.
  return [
    path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
    path.join(home, '.config', 'chromium', 'NativeMessagingHosts'),
    path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
    path.join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts'),
  ];
};

/** Resolve a bundled native-host file, trying packaged then dev-tree layouts. */
const resolveNativeHostFile = (basename: string): string => {
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'native-host', basename),
    path.resolve(__dirname, '../resources/native-host', basename), // dist/main.js → apps/desktop/resources
    path.resolve(__dirname, '../../resources/native-host', basename), // src/ layout
    path.resolve(__dirname, '../../apps/desktop/resources/native-host', basename),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[1];
};

export const resolveNativeHostScript = (): string => resolveNativeHostFile('ljb-browser-host.mjs');

export const resolveNativeHostLauncher = (): string => resolveNativeHostFile('ljb-browser-host');

const shSingleQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/**
 * Write a launcher that runs the native host through **this app's own Node**
 * (`ELECTRON_RUN_AS_NODE`), so it works when the browser spawns it with a bare
 * PATH that has no `node` (the common macOS / nvm case). Falls back to the
 * static `ljb-browser-host` bash script if the file can't be written.
 */
const ensureGeneratedLauncher = (): string => {
  if (process.platform === 'win32') return resolveNativeHostLauncher();
  const launcher = path.join(app.getPath('userData'), 'native-host', 'ljb-browser-host');
  try {
    fs.mkdirSync(path.dirname(launcher), { recursive: true });
    fs.writeFileSync(
      launcher,
      `#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\nexec ${shSingleQuote(process.execPath)} ${shSingleQuote(
        resolveNativeHostScript(),
      )} "$@"\n`,
      { mode: 0o755 },
    );
    return launcher;
  } catch {
    return resolveNativeHostLauncher();
  }
};

const writeNativeManifests = (hostPath: string): void => {
  const manifest = {
    name: NATIVE_HOST_NAME,
    description: 'Le Jean-Baptiste browser import (Wikisource, Kanripo, BDRC)',
    path: hostPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${BROWSER_EXTENSION_ID}/`],
  };
  for (const dir of nativeMessagingDirs()) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${NATIVE_HOST_NAME}.json`),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    } catch {
      // Browser not installed; skip.
    }
  }
};

export const startBrowserImportBridge = (getWindow: () => BrowserWindow | null): http.Server => {
  const token = crypto.randomBytes(24).toString('hex');
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/import') {
      res.writeHead(404);
      res.end();
      return;
    }
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'UNAUTHORIZED' }));
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk as Buffer));
    req.on('end', () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as BrowserImportOrder;
        if (isWikisourceOrder(payload)) {
          if (!payload.url) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'INVALID_ORDER' }));
            return;
          }
        } else if (isKanripoOrder(payload)) {
          if (!payload.kr_id || !payload.url) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'INVALID_ORDER' }));
            return;
          }
        } else if (isBdrcOrder(payload)) {
          if (!payload.etext_id || !payload.url) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'INVALID_ORDER' }));
            return;
          }
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'INVALID_ORDER' }));
          return;
        }
        const win = getWindow();
        if (!win || win.isDestroyed()) {
          res.writeHead(503);
          res.end(JSON.stringify({ error: 'LJB_NOT_RUNNING' }));
          return;
        }
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
        if (isWikisourceOrder(payload)) {
          win.webContents.send('wikisource:import-order', payload);
        } else if (isBdrcOrder(payload)) {
          win.webContents.send('bdrc:import-order', payload);
        } else {
          win.webContents.send('kanripo:import-order', payload);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'INVALID_JSON' }));
      }
    });
  });

  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const record = { port, token, pid: process.pid, userData: app.getPath('userData') };
    const json = `${JSON.stringify(record, null, 2)}\n`;
    const userDataFile = path.join(app.getPath('userData'), 'browser-bridge.json');
    fs.mkdirSync(path.dirname(pointerPath()), { recursive: true });
    fs.writeFileSync(pointerPath(), json);
    fs.writeFileSync(userDataFile, json);
    writeNativeManifests(ensureGeneratedLauncher());
  });

  return server;
};
