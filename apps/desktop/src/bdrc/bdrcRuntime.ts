import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type BdrcImportModule = typeof import('./bdrcImport.mjs');

const resolveBdrcImportModule = (): string => {
  const candidates = [
    path.join(__dirname, 'bdrc', 'bdrcImport.mjs'),
    path.resolve(__dirname, '../src/bdrc/bdrcImport.mjs'),
  ];
  const hit = candidates.find((candidate) => existsSync(candidate));
  if (!hit) throw new Error('bdrcImport.mjs not found in the LJB desktop bundle.');
  return hit;
};

/**
 * Single runtime entry point for `bdrcImport.mjs`.
 *
 * Both callers go through here so the packaged app loads one copy of the
 * module — a second, esbuild-bundled copy would carry its own `bdrcCache.mjs`
 * state.
 */
export const loadBdrcImport = async (): Promise<BdrcImportModule> =>
  import(pathToFileURL(resolveBdrcImportModule()).href) as Promise<BdrcImportModule>;
