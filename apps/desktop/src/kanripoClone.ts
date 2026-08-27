import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

const KR_ID_RE = /^KR[0-9A-Za-z]+$/;
const CLONE_TIMEOUT_MS = 10 * 60 * 1000;

export const assertKanripoId = (krId: string): string => {
  const id = krId.trim();
  if (!KR_ID_RE.test(id)) throw new Error(`Invalid Kanripo id: ${krId}`);
  return id;
};

export const kanripoCacheRoot = (): string => path.join(app.getPath('userData'), 'kanripo-cache');

export const kanripoCachePath = (krId: string): string =>
  path.join(kanripoCacheRoot(), assertKanripoId(krId));

const runGit = (args: string[], cwd?: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`git ${args[0]} timed out`));
    }, CLONE_TIMEOUT_MS);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `git ${args[0]} exited ${code}`));
    });
  });

export const cloneKanripoWork = async (
  krId: string,
): Promise<{ cachePath: string; reused: boolean }> => {
  const id = assertKanripoId(krId);
  const dest = kanripoCachePath(id);
  await fsp.mkdir(kanripoCacheRoot(), { recursive: true });
  const gitDir = path.join(dest, '.git');
  if (fs.existsSync(gitDir)) {
    return { cachePath: dest, reused: true };
  }
  if (fs.existsSync(dest)) {
    await fsp.rm(dest, { recursive: true, force: true });
  }
  const url = `https://github.com/kanripo/${id}`;
  await runGit(['clone', '--depth', '1', '--', url, dest]);
  return { cachePath: dest, reused: false };
};

export const listKanripoTxtFiles = async (cachePath: string): Promise<string[]> => {
  const entries = await fsp.readdir(cachePath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'))
    .map((entry) => path.join(cachePath, entry.name))
    .sort();
};

export const flushKanripoWork = async (krId: string): Promise<void> => {
  const dest = kanripoCachePath(krId);
  await fsp.rm(dest, { recursive: true, force: true });
};
