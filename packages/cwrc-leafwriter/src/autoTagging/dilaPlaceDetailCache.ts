import type { AuthorityCacheFileApi } from './authorityCache';
import type { DilaPlaceDetail } from './dilaPlaceDetail';

// DILA place records are edited rarely; a long TTL avoids re-fetching the
// same id across sessions once we have it.
const TTL_MS = 180 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1000;

interface DilaPlaceDetailCacheEntry {
  fetchedAt: string;
  detail: DilaPlaceDetail;
}

function cacheFileName(id: string): string {
  return `${id.replace(/[^\w-]/g, '_')}.json`;
}

/** Session + disk cache of DILA place-detail scrapes, keyed by DILA place id. */
export class DilaPlaceDetailCache {
  private lastRequestAt = 0;
  private readonly memory = new Map<string, DilaPlaceDetailCacheEntry>();

  constructor(
    private readonly api: AuthorityCacheFileApi | null,
    private readonly cacheDir: string | null,
  ) {}

  private filePath(id: string): string {
    return `${this.cacheDir}/${cacheFileName(id)}`;
  }

  async get(id: string): Promise<DilaPlaceDetail | null> {
    const mem = this.memory.get(id);
    if (mem && Date.now() - Date.parse(mem.fetchedAt) < TTL_MS) return mem.detail;

    if (this.api && this.cacheDir) {
      const path = this.filePath(id);
      if (await this.api.pathExists(path)) {
        try {
          const parsed = JSON.parse(await this.api.readFile(path)) as DilaPlaceDetailCacheEntry;
          if (Date.now() - Date.parse(parsed.fetchedAt) < TTL_MS) {
            this.memory.set(id, parsed);
            return parsed.detail;
          }
        } catch {
          // ignore corrupt cache
        }
      }
    }
    return null;
  }

  async set(id: string, detail: DilaPlaceDetail): Promise<void> {
    const entry: DilaPlaceDetailCacheEntry = { fetchedAt: new Date().toISOString(), detail };
    this.memory.set(id, entry);
    if (!this.api || !this.cacheDir) return;
    await this.api.ensureDirectory(this.cacheDir);
    await this.api.writeFile(this.filePath(id), JSON.stringify(entry));
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
