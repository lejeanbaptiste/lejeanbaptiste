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

export type BrowserImportOrder = WikisourceImportOrder | KanripoImportOrder;

const isWikisourceOrder = (payload: BrowserImportOrder): payload is WikisourceImportOrder =>
  payload?.action === 'import-wikisource';

const isKanripoOrder = (payload: BrowserImportOrder): payload is KanripoImportOrder =>
  payload?.action === 'import-kanripo';

const pointerPath = (): string =>
  path.join(os.homedir(), '.config', 'lejeanbaptiste', 'browser-bridge.json');

const nativeMessagingDirs = (): string[] => {
  const home = os.homedir();
  return [
    path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
    path.join(home, '.config', 'chromium', 'NativeMessagingHosts'),
    path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
  ];
};

export const resolveNativeHostScript = (): string => {
  const packaged = path.join(process.resourcesPath, 'native-host', 'ljb-browser-host.mjs');
  if (fs.existsSync(packaged)) return packaged;
  return path.resolve(__dirname, '../../resources/native-host/ljb-browser-host.mjs');
};

export const resolveNativeHostLauncher = (): string => {
  const packaged = path.join(process.resourcesPath, 'native-host', 'ljb-browser-host');
  if (fs.existsSync(packaged)) return packaged;
  return path.resolve(__dirname, '../../resources/native-host/ljb-browser-host');
};

const writeNativeManifests = (hostPath: string): void => {
  const manifest = {
    name: NATIVE_HOST_NAME,
    description: 'Le Jean-Baptiste browser import (Wikisource and Kanripo)',
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
    writeNativeManifests(resolveNativeHostLauncher());
  });

  return server;
};
