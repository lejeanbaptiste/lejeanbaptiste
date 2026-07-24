import { hashText } from './normalize';

/** One parsed-and-schema-valid item from an LLM response, still chunk-relative (not yet anchored). */
export interface RawLlmItem {
  surface: string;
  occurrence: number;
  tag: string;
  action: string;
  confidence: number;
  rationale: string;
}

export interface LlmCacheFileApi {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  pathExists: (path: string) => Promise<boolean>;
  ensureDirectory: (dir: string) => Promise<void>;
}

interface LlmCacheEntry {
  chunkHash: string;
  tags: string[];
  model: string;
  promptVersion: string;
  cachedAt: string;
  items: RawLlmItem[];
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cache key: (chunk hash, tag set, model, prompt version). A re-run on an
 * unchanged chunk with the same tags/model/prompt costs nothing — this is
 * what makes "re-running on an unchanged document hits cache" true. Stores
 * validated, chunk-relative items (not final anchored Suggestions), since
 * anchoring must always run fresh against the live document.
 */
export class LlmCache {
  private readonly memory = new Map<string, LlmCacheEntry>();

  constructor(
    private readonly api: LlmCacheFileApi | null,
    private readonly cacheDir: string | null,
  ) {}

  private key(chunkText: string, tags: string[], model: string, promptVersion: string): string {
    const chunkHash = hashText(chunkText);
    const tagKey = [...tags].sort().join(',');
    return `${chunkHash}:${tagKey}:${model}:${promptVersion}`;
  }

  private filePath(key: string): string {
    // `:` is illegal in Windows filenames (reserved for NTFS alternate data
    // streams) - the cache key below is colon-delimited, so it must not be
    // in the allowed set here even though it reads fine on macOS/Linux.
    return `${this.cacheDir}/${key.replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`;
  }

  async get(
    chunkText: string,
    tags: string[],
    model: string,
    promptVersion: string,
  ): Promise<RawLlmItem[] | null> {
    const k = this.key(chunkText, tags, model, promptVersion);

    const mem = this.memory.get(k);
    if (mem && Date.now() - Date.parse(mem.cachedAt) < TTL_MS) return mem.items;

    if (this.api && this.cacheDir) {
      const path = this.filePath(k);
      if (await this.api.pathExists(path)) {
        try {
          const parsed = JSON.parse(await this.api.readFile(path)) as LlmCacheEntry;
          if (Date.now() - Date.parse(parsed.cachedAt) < TTL_MS) {
            this.memory.set(k, parsed);
            return parsed.items;
          }
        } catch {
          // ignore corrupt cache entry
        }
      }
    }
    return null;
  }

  async set(
    chunkText: string,
    tags: string[],
    model: string,
    promptVersion: string,
    items: RawLlmItem[],
  ): Promise<void> {
    const k = this.key(chunkText, tags, model, promptVersion);
    const entry: LlmCacheEntry = {
      chunkHash: hashText(chunkText),
      tags: [...tags].sort(),
      model,
      promptVersion,
      cachedAt: new Date().toISOString(),
      items,
    };
    this.memory.set(k, entry);
    if (!this.api || !this.cacheDir) return;
    await this.api.ensureDirectory(this.cacheDir);
    await this.api.writeFile(this.filePath(k), JSON.stringify(entry));
  }
}
