import type { AuthorityLookupResult } from '../types/authority';

export const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1000;

/** Lazily imported so Dexie/IndexedDB is only touched when the global-cache tier is enabled. */
const loadGlobalCache = () => import('./authorityCacheGlobal');

export interface AuthorityCacheEntry {
  authority: string;
  entityType: string;
  query: string;
  fetchedAt: string;
  results: AuthorityLookupResult[];
}

export interface AuthorityCacheFileApi {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  pathExists: (path: string) => Promise<boolean>;
  ensureDirectory: (dir: string) => Promise<void>;
}

function cacheFileName(authority: string, entityType: string, query: string): string {
  const raw = `${authority}\0${entityType}\0${query}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `${hash.toString(16)}.json`;
}

export interface AuthorityCacheOptions {
  /** Cross-project, app-wide IndexedDB fallback tier. Default false — see authorityCacheGlobal.ts. */
  enableGlobalCache?: boolean;
}

export class AuthorityCache {
  private lastRequestAt = 0;
  private readonly memory = new Map<string, AuthorityCacheEntry>();
  private readonly enableGlobalCache: boolean;

  constructor(
    private readonly api: AuthorityCacheFileApi | null,
    private readonly cacheDir: string | null,
    options: AuthorityCacheOptions = {},
  ) {
    this.enableGlobalCache = options.enableGlobalCache ?? false;
  }

  private key(authority: string, entityType: string, query: string): string {
    return `${authority}:${entityType}:${query}`;
  }

  private filePath(authority: string, entityType: string, query: string): string {
    return `${this.cacheDir}/${cacheFileName(authority, entityType, query)}`;
  }

  private async writeFileTier(entry: AuthorityCacheEntry): Promise<void> {
    if (!this.api || !this.cacheDir) return;
    await this.api.ensureDirectory(this.cacheDir);
    await this.api.writeFile(
      this.filePath(entry.authority, entry.entityType, entry.query),
      JSON.stringify(entry),
    );
  }

  async get(
    authority: string,
    entityType: string,
    query: string,
    forceRefresh = false,
  ): Promise<AuthorityCacheEntry | null> {
    const k = this.key(authority, entityType, query);
    if (!forceRefresh) {
      const mem = this.memory.get(k);
      if (mem && Date.now() - Date.parse(mem.fetchedAt) < TTL_MS) return mem;

      if (this.api && this.cacheDir) {
        const path = this.filePath(authority, entityType, query);
        if (await this.api.pathExists(path)) {
          try {
            const parsed = JSON.parse(await this.api.readFile(path)) as AuthorityCacheEntry;
            if (Date.now() - Date.parse(parsed.fetchedAt) < TTL_MS) {
              this.memory.set(k, parsed);
              return parsed;
            }
          } catch {
            // ignore corrupt cache
          }
        }
      }

      if (this.enableGlobalCache) {
        try {
          const { getGlobalEntry } = await loadGlobalCache();
          const row = await getGlobalEntry(authority, entityType, query);
          if (row) {
            const entry: AuthorityCacheEntry = {
              authority: row.authority,
              entityType: row.entityType,
              query: row.query,
              fetchedAt: row.fetchedAt,
              results: row.results,
            };
            this.memory.set(k, entry);
            await this.writeFileTier(entry);
            return entry;
          }
        } catch {
          // global tier is a best-effort fallback, never a requirement
        }
      }
    }
    return null;
  }

  async set(entry: AuthorityCacheEntry): Promise<void> {
    const k = this.key(entry.authority, entry.entityType, entry.query);
    this.memory.set(k, entry);
    await this.writeFileTier(entry);

    if (this.enableGlobalCache) {
      try {
        const { setGlobalEntry } = await loadGlobalCache();
        await setGlobalEntry(entry);
      } catch {
        // best-effort — never let the global tier break a successful cache write
      }
    }
  }

  /** Wait until polite to fire another network request. */
  async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
    }
    this.lastRequestAt = Date.now();
  }
}
