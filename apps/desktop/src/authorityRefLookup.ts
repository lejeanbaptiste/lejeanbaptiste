/**
 * A6 reference lookup — reads slim CBDB / Norbert sqlite or DILA person TEI
 * via the authority-extraction CLI (better-sqlite3 / TEI parsers live there).
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import type {
  AuthorityRefLookupRequest,
  AuthorityRefLookupResult,
  AuthorityRefSourceId,
} from '../../commons/src/desktop/authorityRefTypes';
import { resolveAuthorityExtractionRoot } from './authorityCompile';

const execFileAsync = promisify(execFile);
const LOOKUP_TIMEOUT_MS = 60_000;

export type {
  AuthorityRefLookupRequest,
  AuthorityRefLookupResult,
  AuthorityRefSourceId,
} from '../../commons/src/desktop/authorityRefTypes';

export const referenceDbPath = (
  authorityDatabasesDir: string,
  source: AuthorityRefSourceId,
): string => {
  if (source === 'cbdb') {
    const slim = path.join(authorityDatabasesDir, 'cbdb-person.sqlite3');
    if (fs.existsSync(slim)) return slim;
    return path.join(authorityDatabasesDir, 'cbdb.sqlite3');
  }
  if (source === 'norbert') return path.join(authorityDatabasesDir, 'norbert.sqlite3');
  return path.join(authorityDatabasesDir, 'dila-person.xml');
};

export const isReferenceSourceInstalled = (
  authorityDatabasesDir: string | null,
  source: AuthorityRefSourceId,
): boolean => {
  if (!authorityDatabasesDir) return false;
  return fs.existsSync(referenceDbPath(authorityDatabasesDir, source));
};

/**
 * Look up one person in the installed reference database.
 * `authorityDatabasesDir` is `<assets>/authority-databases` (same as download target).
 * Returns null when the source is not installed or the id is unknown.
 */
export const lookupAuthorityRef = async (
  authorityDatabasesDir: string | null,
  request: AuthorityRefLookupRequest,
): Promise<AuthorityRefLookupResult | null> => {
  if (!authorityDatabasesDir) return null;
  const source = request.source;
  const authorityId = String(request.authorityId ?? '').trim();
  if (!authorityId) return null;
  if (!isReferenceSourceInstalled(authorityDatabasesDir, source)) return null;

  let root: string;
  try {
    root = resolveAuthorityExtractionRoot('scripts/authority-ref-lookup.mjs');
  } catch {
    return null;
  }

  const script = path.join(root, 'scripts/authority-ref-lookup.mjs');
  const filePath = referenceDbPath(authorityDatabasesDir, source);
  const args =
    source === 'dila'
      ? [script, '--source', 'dila', '--id', authorityId, '--xml', filePath]
      : [script, '--source', source, '--id', authorityId, '--db', filePath];

  try {
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
      timeout: LOOKUP_TIMEOUT_MS,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_PATH: path.join(root, 'node_modules'),
      },
    });
    const trimmed = stdout.trim();
    if (!trimmed || trimmed === 'null') return null;
    return JSON.parse(trimmed) as AuthorityRefLookupResult;
  } catch {
    return null;
  }
};
