import {
  applyConcordanceAssociations,
  type ConcordanceAssociation,
  type ConcordanceImportResult,
} from './entityOps';
import { authorityPackLines, type AuthorityPackContent } from './packLoader';
import type { AuthorityPackId } from './packPaths';

/** Authority type for CBDB person-concordance ids (never bibliographic c_source). */
export const CBDB_CONCORDANCE_SOURCE = 'CBDB';

/**
 * Parse the CBDB person-concordance NDJSON pack into associations.
 *
 * Pack rows are usually `{ canonicalId, mergedFromId, notes }` only. A rare
 * `source` field is a bibliographic id (c_source), not an authority type — so
 * this always forces `source` to `CBDB`.
 */
export function parseCbdbConcordanceAssociations(
  content: AuthorityPackContent,
): ConcordanceAssociation[] {
  const associations: ConcordanceAssociation[] = [];
  for (const line of authorityPackLines(content)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: {
      canonicalId?: unknown;
      mergedFromId?: unknown;
      notes?: unknown;
    };
    try {
      row = JSON.parse(trimmed) as typeof row;
    } catch {
      continue;
    }
    const canonicalId = String(row.canonicalId ?? '').trim();
    const mergedFromId = String(row.mergedFromId ?? '').trim();
    if (!canonicalId || !mergedFromId) continue;
    const notes = typeof row.notes === 'string' && row.notes.trim() ? row.notes : undefined;
    associations.push({
      source: CBDB_CONCORDANCE_SOURCE,
      canonicalId,
      mergedFromId,
      ...(notes ? { notes } : {}),
    });
  }
  return associations;
}

export type CbdbConcordancePackReader = (
  packId: AuthorityPackId,
) => Promise<AuthorityPackContent>;

export type CbdbConcordanceSqliteStore = {
  sqliteApplyConcordance: (
    associations: ConcordanceAssociation[],
  ) => Promise<ConcordanceImportResult>;
};

/**
 * Load the installed CBDB concordance pack and apply it via SQLite.
 * Returns null when the pack reader or file is unavailable.
 */
export async function refreshCbdbConcordanceSqlite(
  store: CbdbConcordanceSqliteStore,
  readPack: CbdbConcordancePackReader | undefined,
): Promise<ConcordanceImportResult | null> {
  if (!readPack) return null;
  try {
    const content = await readPack('cbdb-concordance');
    const associations = parseCbdbConcordanceAssociations(content);
    if (associations.length === 0) {
      return {
        applied: 0,
        alreadyPresent: 0,
        rejected: 0,
        unresolved: 0,
        conflicts: [],
      };
    }
    return await store.sqliteApplyConcordance(associations);
  } catch {
    // Older installations may not yet have the concordance file.
    return null;
  }
}

/**
 * Apply already-parsed CBDB concordance associations to an XML entity document
 * (pre-migration databases only).
 */
export function refreshCbdbConcordanceDom(
  doc: Document,
  associations: ConcordanceAssociation[],
): ConcordanceImportResult {
  return applyConcordanceAssociations(doc, associations);
}

/**
 * Load pack associations for the XML refresh path. Returns null when unavailable.
 */
export async function loadCbdbConcordanceAssociations(
  readPack: CbdbConcordancePackReader | undefined,
): Promise<ConcordanceAssociation[] | null> {
  if (!readPack) return null;
  try {
    const content = await readPack('cbdb-concordance');
    return parseCbdbConcordanceAssociations(content);
  } catch {
    return null;
  }
}
