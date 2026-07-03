import type { BrowserWindow } from 'electron';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { ipcMain } from 'electron';
import path from 'path';
import { app } from 'electron';
import { pathToFileURL } from 'url';
import { spawnLemminxProcess } from './spawnLemminx';

export interface LspStartOptions {
  defaultSchemaRng?: string;
  projectRoot?: string;
}

let lemminxProcess: ChildProcessWithoutNullStreams | null = null;
let stdoutBuffer = Buffer.alloc(0);
let getMainWindow: () => BrowserWindow | null = () => null;
let started = false;
let initOptions: LspStartOptions = {};

const sendToRenderer = (message: unknown) => {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('lsp:message', message);
};

const writeLspMessage = (message: unknown) => {
  if (!lemminxProcess?.stdin.writable) return;
  const content = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
  lemminxProcess.stdin.write(header + content, 'utf8');
};

const processStdoutBuffer = () => {
  while (true) {
    const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    const header = stdoutBuffer.subarray(0, headerEnd).toString('utf8');
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) {
      stdoutBuffer = stdoutBuffer.subarray(headerEnd + 4);
      continue;
    }

    const length = parseInt(lengthMatch[1], 10);
    const bodyStart = headerEnd + 4;
    if (stdoutBuffer.length < bodyStart + length) return;

    const body = stdoutBuffer.subarray(bodyStart, bodyStart + length).toString('utf8');
    stdoutBuffer = stdoutBuffer.subarray(bodyStart + length);

    try {
      sendToRenderer(JSON.parse(body));
    } catch (error) {
      console.error('[lemminx] Failed to parse LSP message:', error);
    }
  }
};

const buildInitializationOptions = () => {
  const workDir = path.join(app.getPath('userData'), 'lemminx-cache');
  const fileAssociations: Array<{ pattern: string; systemId: string }> = [];

  if (initOptions.defaultSchemaRng && initOptions.projectRoot) {
    const schemaPath = path.isAbsolute(initOptions.defaultSchemaRng)
      ? initOptions.defaultSchemaRng
      : path.join(initOptions.projectRoot, initOptions.defaultSchemaRng);
    fileAssociations.push({
      pattern: '**/*.xml',
      systemId: pathToFileURL(schemaPath).href,
    });
  }

  return {
    settings: {
      xml: {
        completion: { autoCloseTags: true },
        format: { enabled: true },
        validation: { enabled: true },
        server: {
          preferBinary: true,
          workDir,
        },
        ...(fileAssociations.length > 0 ? { fileAssociations } : {}),
      },
    },
  };
};

const startLemminx = () => {
  if (started && lemminxProcess && !lemminxProcess.killed) return;

  lemminxProcess = spawnLemminxProcess();
  stdoutBuffer = Buffer.alloc(0);
  started = true;

  lemminxProcess.stdout.on('data', (chunk: Buffer) => {
    stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    processStdoutBuffer();
  });

  lemminxProcess.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trim();
    if (text) console.warn('[lemminx]', text);
  });

  lemminxProcess.on('exit', (code) => {
    console.warn('[lemminx] process exited with code', code);
    lemminxProcess = null;
    started = false;
  });
};

const stopLemminx = () => {
  if (!lemminxProcess) return;
  lemminxProcess.kill();
  lemminxProcess = null;
  started = false;
  stdoutBuffer = Buffer.alloc(0);
};

export const registerLemminxIpc = (getWindow: () => BrowserWindow | null) => {
  getMainWindow = getWindow;

  ipcMain.handle('lsp:start', (_event, options?: LspStartOptions) => {
    initOptions = options ?? {};
    try {
      startLemminx();
      return { ok: true, initializationOptions: buildInitializationOptions() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[lemminx] start failed:', message);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle('lsp:stop', () => {
    stopLemminx();
    return { ok: true };
  });

  ipcMain.handle('lsp:send', (_event, message: unknown) => {
    if (!lemminxProcess) {
      try {
        startLemminx();
      } catch {
        return { ok: false };
      }
    }
    writeLspMessage(message);
    return { ok: true };
  });
};

export const disposeLemminx = () => {
  stopLemminx();
};
