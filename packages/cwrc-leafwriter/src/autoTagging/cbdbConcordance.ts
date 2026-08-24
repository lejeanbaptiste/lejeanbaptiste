import {
  applyConcordanceAssociations,
  type ConcordanceAssociation,
  type ConcordanceImportResult,
} from './entityOps';
import { authorityPackLines, type AuthorityPackContent } from './packLoader';
import type { AuthorityPackId } from './packPaths';
import { clearPackContentCache, cachedPackReader } from '../services/authority-pack-lookup';
import { entityStoreFromDesktop } from './entityStore';

/** Authority type for CBDB person-concordance ids (never bibliographic c_source). */
export const CBDB_CONCORDANCE_SOURCE = 'CBDB';

/** Pack id whose install/update should re-apply person concordance. */
export const CBDB_CONCORDANCE_PACK_ID: AuthorityPackId = 'cbdb-concordance';

/**
 * Packs whose install/update should trigger concordance refresh.
 * Today only the dedicated concordance pack; kept as a set for similar add-ons.
 */
export const CONCORDANCE_LIFECYCLE_PACK_IDS: ReadonlySet<AuthorityPackId> = new Set([
  CBDB_CONCORDANCE_PACK_ID,
]);

/** Skip a repeat apply on the same SQLite path within this window (panel reload safety net). */
export const CBDB_CONCORDANCE_REFRESH_DEBOUNCE_MS = 15_000;

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

export type CbdbConcordancePackReader = (packId: AuthorityPackId) => Promise<AuthorityPackContent>;

export interface CbdbConcordanceSqliteStore {
  sqliteApplyConcordance: (
    associations: ConcordanceAssociation[],
  ) => Promise<ConcordanceImportResult>;
}

/** Store shape needed for debounce keys + optional SQLite presence check. */
export type CbdbConcordanceRefreshStore = CbdbConcordanceSqliteStore & {
  sqlitePath: string;
  hasSqliteDatabase?: () => Promise<boolean>;
};

/**
 * True when known pack ids include a concordance-related pack.
 * Empty / omitted lists mean "unknown set" (e.g. full profile bundle) — callers
 * should still refresh, since chinese bundles may ship person-concordance.ndjson
 * even when it is not listed in lifecycle profile packIds.
 */
export function packIdsAffectConcordance(packIds: readonly string[] | undefined): boolean {
  if (!packIds || packIds.length === 0) return true;
  return packIds.some((id) => CONCORDANCE_LIFECYCLE_PACK_IDS.has(id as AuthorityPackId));
}

interface RefreshGate {
  inflight: Map<string, Promise<ConcordanceImportResult | null>>;
  completedAt: Map<string, number>;
  lastResult: Map<string, ConcordanceImportResult | null>;
}

const refreshGate: RefreshGate = {
  inflight: new Map(),
  completedAt: new Map(),
  lastResult: new Map(),
};

/** Test helper — clears debounce/coalesce state between cases. */
export function resetCbdbConcordanceRefreshGateForTests(): void {
  refreshGate.inflight.clear();
  refreshGate.completedAt.clear();
  refreshGate.lastResult.clear();
}

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
    const content = await readPack(CBDB_CONCORDANCE_PACK_ID);
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

export interface RefreshCbdbConcordanceDebounceOptions {
  /** Always apply (pack install/update, post-backfill). Default false skips within debounce. */
  force?: boolean;
  /** Drop cached pack contents before reading. Default true. */
  clearCache?: boolean;
  /** Override clock for tests. */
  now?: number;
  /** Override debounce window for tests. */
  debounceMs?: number;
}

/**
 * Apply concordance with in-flight coalescing and a short debounce so a panel
 * reload right after pack-lifecycle refresh does not re-pay the full cost.
 * Use `force: true` after pack install/update or authority backfill.
 */
export async function refreshCbdbConcordanceSqliteDebounced(
  store: CbdbConcordanceRefreshStore,
  readPack: CbdbConcordancePackReader | undefined,
  options?: RefreshCbdbConcordanceDebounceOptions,
): Promise<ConcordanceImportResult | null> {
  const key = store.sqlitePath;
  const force = options?.force === true;
  const now = options?.now ?? Date.now();
  const debounceMs = options?.debounceMs ?? CBDB_CONCORDANCE_REFRESH_DEBOUNCE_MS;

  if (!force) {
    const completedAt = refreshGate.completedAt.get(key);
    if (completedAt != null && now - completedAt < debounceMs) {
      // Reuse the prior result so panel reload can still surface conflicts.
      return refreshGate.lastResult.has(key) ? (refreshGate.lastResult.get(key) ?? null) : null;
    }
  }

  const existing = refreshGate.inflight.get(key);
  if (existing) return existing;

  const run = (async (): Promise<ConcordanceImportResult | null> => {
    try {
      if (store.hasSqliteDatabase && !(await store.hasSqliteDatabase())) return null;
      if (options?.clearCache !== false) {
        clearPackContentCache([CBDB_CONCORDANCE_PACK_ID]);
      }
      const result = await refreshCbdbConcordanceSqlite(store, readPack);
      refreshGate.lastResult.set(key, result);
      if (result) refreshGate.completedAt.set(key, options?.now ?? Date.now());
      return result;
    } finally {
      refreshGate.inflight.delete(key);
    }
  })();

  refreshGate.inflight.set(key, run);
  return run;
}

export interface RefreshCbdbConcordanceAfterPackLifecycleDeps {
  /** Defaults to the open project PEDB (same target as Database panel reload). */
  resolveStore?: () => CbdbConcordanceRefreshStore | null;
  readPack?: CbdbConcordancePackReader | undefined;
  /** When provided and non-empty without concordance packs, skip. */
  packIds?: readonly string[];
  force?: boolean;
}

/**
 * After authority pack install/update: re-apply CBDB concordance to the open
 * project entity database (PEDB). No-op when no project/SQLite is available —
 * Database panel reload remains the safety net.
 */
export async function refreshCbdbConcordanceAfterPackLifecycle(
  deps?: RefreshCbdbConcordanceAfterPackLifecycleDeps,
): Promise<ConcordanceImportResult | null> {
  if (!packIdsAffectConcordance(deps?.packIds)) return null;

  const resolveStore =
    deps?.resolveStore ??
    (() => {
      const store = entityStoreFromDesktop();
      return store;
    });
  const store = resolveStore();
  if (!store) return null;

  const readPack = deps?.readPack ?? cachedPackReader();
  return refreshCbdbConcordanceSqliteDebounced(store, readPack, {
    force: deps?.force !== false,
    clearCache: true,
  });
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
    const content = await readPack(CBDB_CONCORDANCE_PACK_ID);
    return parseCbdbConcordanceAssociations(content);
  } catch {
    return null;
  }
}
