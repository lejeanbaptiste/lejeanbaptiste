import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';

export const NATIVE_HOST_NAME = 'org.grognard.import';
/** Pinned unpacked-extension id (see apps/browser-extension/manifest.json key). */
export const BROWSER_EXTENSION_ID = 'dddnkaleimllefhfolmhdfbidnjfojjh';
/** Firefox add-on id (see apps/browser-extension/manifest.firefox.json). */
export const BROWSER_EXTENSION_GECKO_ID = 'grognard-corpus-import@grognard.org';

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
  path.join(os.homedir(), '.config', 'grognard', 'browser-bridge.json');

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
  // Linux (XDG). Windows uses the registry instead — see registerWindowsNativeHost.
  return [
    path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
    path.join(home, '.config', 'chromium', 'NativeMessagingHosts'),
    path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
    path.join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts'),
  ];
};

const firefoxNativeMessagingDirs = (): string[] => {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return [path.join(home, 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts')];
  }
  // Linux. Windows uses the registry instead — see registerWindowsNativeHost.
  return [path.join(home, '.mozilla', 'native-messaging-hosts')];
};

/**
 * Per-user registry roots whose `NativeMessagingHosts\<name>` subkey points a
 * browser at a host manifest file (Windows only). Chromium forks and Firefox
 * read different roots but the same manifest shape (bar allowed_origins vs
 * allowed_extensions).
 */
const WINDOWS_CHROMIUM_REGISTRY_ROOTS = [
  'Software\\Google\\Chrome',
  'Software\\BraveSoftware\\Brave-Browser',
  'Software\\Chromium',
  'Software\\Microsoft\\Edge',
];
const WINDOWS_FIREFOX_REGISTRY_ROOTS = ['Software\\Mozilla'];

const regExe = (): string =>
  process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'reg.exe') : 'reg.exe';

/** `HKCU\<root>\NativeMessagingHosts\<name>` (default value) → manifest path. */
const setRegistryHostKey = (root: string, manifestPath: string): void => {
  const key = `HKCU\\${root}\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
  try {
    execFileSync(regExe(), ['add', key, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // reg.exe missing or key not writable; skip this browser.
  }
};

/**
 * Windows equivalent of dropping a manifest into `NativeMessagingHosts/`: write
 * the manifest files to userData and register their paths under HKCU for every
 * supported browser. HKCU needs no elevation.
 */
const registerWindowsNativeHost = (chromeManifest: object, firefoxManifest: object): void => {
  const dir = path.join(app.getPath('userData'), 'native-host');
  const chromePath = path.join(dir, `${NATIVE_HOST_NAME}.json`);
  const firefoxPath = path.join(dir, `${NATIVE_HOST_NAME}.firefox.json`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(chromePath, `${JSON.stringify(chromeManifest, null, 2)}\n`);
    fs.writeFileSync(firefoxPath, `${JSON.stringify(firefoxManifest, null, 2)}\n`);
  } catch {
    return;
  }
  for (const root of WINDOWS_CHROMIUM_REGISTRY_ROOTS) setRegistryHostKey(root, chromePath);
  for (const root of WINDOWS_FIREFOX_REGISTRY_ROOTS) setRegistryHostKey(root, firefoxPath);
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

export const resolveNativeHostScript = (): string => resolveNativeHostFile('grognard-browser-host.mjs');

export const resolveNativeHostLauncher = (): string => resolveNativeHostFile('grognard-browser-host');

const shSingleQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/**
 * Write a launcher that runs the native host through **this app's own Node**
 * (`ELECTRON_RUN_AS_NODE`), so it works when the browser spawns it with a bare
 * PATH that has no `node` (the common macOS / nvm case, and every Windows
 * install). Falls back to the static `grognard-browser-host` bash script if the file
 * can't be written. On Windows the browser can only spawn `.exe`/`.bat`/`.cmd`,
 * so the launcher is a `.bat` wrapper around the app exe (the form both the
 * Chrome and Firefox native-messaging docs use for script hosts).
 */
const ensureGeneratedLauncher = (): string => {
  if (process.platform === 'win32') {
    const bat = path.join(app.getPath('userData'), 'native-host', 'grognard-browser-host.bat');
    try {
      fs.mkdirSync(path.dirname(bat), { recursive: true });
      fs.writeFileSync(
        bat,
        [
          '@echo off',
          'set "ELECTRON_RUN_AS_NODE=1"',
          `"${process.execPath}" "${resolveNativeHostScript()}" %*`,
          '',
        ].join('\r\n'),
      );
      return bat;
    } catch {
      return resolveNativeHostLauncher();
    }
  }
  const launcher = path.join(app.getPath('userData'), 'native-host', 'grognard-browser-host');
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
  const base = {
    name: NATIVE_HOST_NAME,
    description: 'Grognard browser import (Wikisource, Kanripo, BDRC)',
    path: hostPath,
    type: 'stdio' as const,
  };
  const chromeManifest = {
    ...base,
    allowed_origins: [`chrome-extension://${BROWSER_EXTENSION_ID}/`],
  };
  const firefoxManifest = {
    ...base,
    allowed_extensions: [BROWSER_EXTENSION_GECKO_ID],
  };
  if (process.platform === 'win32') {
    registerWindowsNativeHost(chromeManifest, firefoxManifest);
    return;
  }
  const write = (dir: string, manifest: object): void => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${NATIVE_HOST_NAME}.json`),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    } catch {
      // Browser not installed; skip.
    }
  };
  for (const dir of nativeMessagingDirs()) write(dir, chromeManifest);
  for (const dir of firefoxNativeMessagingDirs()) write(dir, firefoxManifest);
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
          res.end(JSON.stringify({ error: 'GROGNARD_NOT_RUNNING' }));
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
