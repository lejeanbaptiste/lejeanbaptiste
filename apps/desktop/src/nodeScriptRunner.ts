/**
 * Shared helper for spawning bundled `authority extraction` Node scripts from
 * the Electron main process. Split out from authorityCompile.ts so that
 * authorityDatabases.ts can use it too without a circular import (authorityCompile.ts
 * already imports AUTHORITY_DB_DIRNAME from authorityDatabases.ts).
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const RUN_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Resolve sibling repo (dev) or bundled copy (packaged app). `marker` is a
 * script path relative to the root used to confirm the candidate is actually
 * populated.
 */
export const resolveAuthorityExtractionRoot = (marker = 'cbdb/compile.mjs'): string => {
  const candidates = [
    path.join(process.resourcesPath, 'authority-extraction'),
    path.resolve(__dirname, '../../../../authority extraction'),
    path.resolve(process.cwd(), '../authority extraction'),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, marker))) return root;
  }
  throw new Error(
    'Authority compile bundle not found. Install the authority extraction repo as a sibling of leaf-writer, or bundle it under resources/authority-extraction.',
  );
};

/** Runs a bundled toolchain script via Electron's own Node runtime — packaged
 * installs have no system `node` on PATH, so scripts must be spawned as the
 * Electron binary itself with ELECTRON_RUN_AS_NODE, not as `node`. */
export const runNodeScript = async (
  scriptPath: string,
  args: string[],
  cwd: string,
): Promise<void> => {
  const nodeModules = path.join(cwd, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    throw new Error(
      `Run npm install in the authority extraction folder (${cwd}) before compiling.`,
    );
  }

  await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    timeout: RUN_TIMEOUT_MS,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_PATH: nodeModules,
    },
  });
};
