import Dexie, { type Table } from 'dexie';
import type { AuthorityLookupResult } from '../types/authority';
import { TTL_MS } from './authorityCache';

/** Cross-project, app-wide cache: an authority result found in one project is available in every other. */
export interface GlobalAuthorityCacheRow {
  id: string;
  authority: string;
  entityType: string;
  query: string;
  fetchedAt: string;
  lastAccessedAt: string;
  results: AuthorityLookupResult[];
}

export const MAX_ENTRIES = 5000;
/** Only re-check the eviction cap every N writes — avoids a `.count()` query on every single write. */
const EVICTION_CHECK_INTERVAL = 20;

class AuthorityCacheGlobalDb extends Dexie {
  lookups!: Table<GlobalAuthorityCacheRow, string>;

  constructor() {
    super('LEAF-Writer-AuthorityCache');
    this.version(1).stores({
      lookups: 'id, lastAccessedAt',
    });
  }
}

let db: AuthorityCacheGlobalDb | null = null;
function getDb(): AuthorityCacheGlobalDb {
  db ??= new AuthorityCacheGlobalDb();
  return db;
}

function rowKey(authority: string, entityType: string, query: string): string {
  return `${authority}:${entityType}:${query}`;
}

let writesSinceEvictionCheck = 0;

async function evictIfOverCap(): Promise<void> {
  writesSinceEvictionCheck += 1;
  if (writesSinceEvictionCheck < EVICTION_CHECK_INTERVAL) return;
  writesSinceEvictionCheck = 0;

  const table = getDb().lookups;
  const count = await table.count();
  const over = count - MAX_ENTRIES;
  if (over <= 0) return;

  const staleKeys = await table.orderBy('lastAccessedAt').limit(over).primaryKeys();
  await table.bulkDelete(staleKeys);
}

/** Global-tier read. Returns null on miss, expiry, or any storage error. */
export async function getGlobalEntry(
  authority: string,
  entityType: string,
  query: string,
): Promise<GlobalAuthorityCacheRow | null> {
  try {
    const row = await getDb().lookups.get(rowKey(authority, entityType, query));
    if (!row) return null;
    if (Date.now() - Date.parse(row.fetchedAt) >= TTL_MS) return null;
    void getDb().lookups.update(row.id, { lastAccessedAt: new Date().toISOString() });
    return row;
  } catch {
    return null;
  }
}

/** Global-tier write-through. Best-effort — failures never surface to the caller. */
export async function setGlobalEntry(entry: {
  authority: string;
  entityType: string;
  query: string;
  fetchedAt: string;
  results: AuthorityLookupResult[];
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    await getDb().lookups.put({
      id: rowKey(entry.authority, entry.entityType, entry.query),
      authority: entry.authority,
      entityType: entry.entityType,
      query: entry.query,
      fetchedAt: entry.fetchedAt,
      lastAccessedAt: now,
      results: entry.results,
    });
    await evictIfOverCap();
  } catch {
    // best-effort — global cache is a fallback, never a requirement
  }
}

/**
 * Test-only: empty the table and reset in-process state. fake-indexeddb's storage
 * outlives any single test file within a jest worker, so tests must call this
 * themselves (e.g. in `afterEach`) rather than relying on module isolation.
 */
export async function clearGlobalAuthorityCacheForTests(): Promise<void> {
  await getDb().lookups.clear();
  writesSinceEvictionCheck = 0;
}
