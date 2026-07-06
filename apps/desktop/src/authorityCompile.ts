/**
 * Spawn authority extraction compile scripts against raw databases in the entity folder.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { AUTHORITY_DB_DIRNAME } from './authorityDatabases';

const execFileAsync = promisify(execFile);

const COMPILE_TIMEOUT_MS = 30 * 60 * 1000;

/** Resolve sibling repo (dev) or bundled copy (packaged app). */
export const resolveAuthorityExtractionRoot = (): string => {
  const candidates = [
    path.join(process.resourcesPath, 'authority-extraction'),
    path.resolve(__dirname, '../../../../authority extraction'),
    path.resolve(process.cwd(), '../authority extraction'),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'cbdb/compile.mjs'))) return root;
  }
  throw new Error(
    'Authority compile bundle not found. Install the authority extraction repo as a sibling of leaf-writer, or bundle it under resources/authority-extraction.',
  );
};

const runNodeScript = async (
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

  await execFileAsync('node', [scriptPath, ...args], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    timeout: COMPILE_TIMEOUT_MS,
    env: {
      ...process.env,
      NODE_PATH: nodeModules,
    },
  });
};

export interface CompileAuthorityPacksOptions {
  entityDbFolder: string;
  outDir: string;
  onProgress?: (message: string) => void;
}

/** Write compiled NDJSON packs to `outDir` (cbdb/ and dila/ subfolders). */
export const compileAuthorityPacks = async ({
  entityDbFolder,
  outDir,
  onProgress,
}: CompileAuthorityPacksOptions): Promise<void> => {
  const rawDir = path.join(entityDbFolder, AUTHORITY_DB_DIRNAME);
  const sqlite = path.join(rawDir, 'cbdb.sqlite3');
  const persons = path.join(rawDir, 'dila-person.xml');
  const places = path.join(rawDir, 'dila-place.xml');
  const districts = path.join(rawDir, 'dila-districts.xml');

  for (const [label, filePath] of [
    ['CBDB sqlite', sqlite],
    ['DILA persons', persons],
    ['DILA places', places],
    ['DILA districts', districts],
  ] as const) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing ${label}: ${filePath}`);
    }
  }

  const root = resolveAuthorityExtractionRoot();
  const cbdbOut = path.join(outDir, 'cbdb');
  const dilaOut = path.join(outDir, 'dila');

  onProgress?.('Compiling CBDB persons, places, and offices…');
  await runNodeScript(
    path.join(root, 'cbdb/compile.mjs'),
    ['--sqlite', sqlite, '--out', cbdbOut],
    root,
  );

  onProgress?.('Compiling DILA persons and places…');
  await runNodeScript(
    path.join(root, 'dila/compile.mjs'),
    [
      '--persons',
      persons,
      '--places',
      places,
      '--districts',
      districts,
      '--out',
      dilaOut,
    ],
    root,
  );
};
