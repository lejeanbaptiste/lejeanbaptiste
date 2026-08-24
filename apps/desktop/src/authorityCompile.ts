/**
 * Spawn authority extraction compile scripts against raw databases in the entity folder.
 */

import fs from 'node:fs';
import path from 'node:path';

import { AUTHORITY_DB_DIRNAME } from './authorityDatabases';
import { resolveAuthorityExtractionRoot, runNodeScript } from './nodeScriptRunner';

// Re-exported for existing importers (authorityRefLookup.ts and others) —
// the implementations now live in nodeScriptRunner.ts so authorityDatabases.ts
// can use them too without a circular import (this file already imports
// AUTHORITY_DB_DIRNAME from authorityDatabases.ts).
export { resolveAuthorityExtractionRoot, runNodeScript };

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
    ['--persons', persons, '--places', places, '--districts', districts, '--out', dilaOut],
    root,
  );
};
