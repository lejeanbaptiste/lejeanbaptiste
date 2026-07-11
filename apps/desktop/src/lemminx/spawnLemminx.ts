import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { chmodSync, existsSync } from 'fs';
import path from 'path';
import { app } from 'electron';

export const getLemminxBinaryPath = (): string | null => {
  const platform = process.platform;
  const arch = process.arch === 'arm64' ? 'aarch_64' : 'x86_64';
  const binaryName =
    platform === 'darwin'
      ? `lemminx-osx-${arch}`
      : platform === 'win32'
        ? `lemminx-win-${arch}.exe`
        : null;

  if (!binaryName) return null;

  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'lemminx')
    : path.join(__dirname, '../../resources/lemminx');

  const binaryPath = path.join(base, binaryName);
  return existsSync(binaryPath) ? binaryPath : null;
};

export const spawnLemminxProcess = (): ChildProcessWithoutNullStreams => {
  const binaryPath = getLemminxBinaryPath();
  if (!binaryPath) {
    throw new Error(
      'LemMinX binary not found for this platform. Run: npm run lemminx:download -w le-jean-baptiste-desktop',
    );
  }

  if (process.platform !== 'win32') {
    chmodSync(binaryPath, 0o755);
  }

  return spawn(binaryPath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
};
