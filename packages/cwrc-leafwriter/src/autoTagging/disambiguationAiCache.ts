import { hashText } from './normalize';

export interface DisambiguationAiRankResult {
  selectedCandidateIds: string[];
  rationales: Record<string, string>;
  /** Per-selected-candidate confidence (0-1); absent on cache entries written before this field existed. */
  confidences?: Record<string, number>;
  suggestCreateNew: boolean;
  createNewRationale?: string;
}

export interface DisambiguationAiCacheFileApi {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  pathExists: (path: string) => Promise<boolean>;
  ensureDirectory: (dir: string) => Promise<void>;
}

interface DisambiguationAiCacheEntry {
  cacheKey: string;
  model: string;
  promptVersion: string;
  cachedAt: string;
  result: DisambiguationAiRankResult;
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class DisambiguationAiCache {
  private readonly memory = new Map<string, DisambiguationAiCacheEntry>();

  constructor(
    private readonly api: DisambiguationAiCacheFileApi | null,
    private readonly cacheDir: string | null,
  ) {}

  private filePath(key: string): string | null {
    if (!this.cacheDir) return null;
    return `${this.cacheDir}/${key}.json`;
  }

  cacheKey(
    tag: string,
    surface: string,
    candidateIds: string[],
    contextText: string,
    model: string,
    promptVersion: string,
  ): string {
    return hashText(
      [tag, surface, [...candidateIds].sort().join(','), contextText, model, promptVersion].join('\0'),
    );
  }

  async get(key: string): Promise<DisambiguationAiRankResult | null> {
    const mem = this.memory.get(key);
    if (mem && Date.now() - Date.parse(mem.cachedAt) < TTL_MS) return mem.result;

    const path = this.filePath(key);
    if (!path || !this.api) return null;
    if (!(await this.api.pathExists(path))) return null;

    try {
      const parsed = JSON.parse(await this.api.readFile(path)) as DisambiguationAiCacheEntry;
      if (Date.now() - Date.parse(parsed.cachedAt) >= TTL_MS) return null;
      this.memory.set(key, parsed);
      return parsed.result;
    } catch {
      return null;
    }
  }

  async set(key: string, model: string, promptVersion: string, result: DisambiguationAiRankResult): Promise<void> {
    const entry: DisambiguationAiCacheEntry = {
      cacheKey: key,
      model,
      promptVersion,
      cachedAt: new Date().toISOString(),
      result,
    };
    this.memory.set(key, entry);

    const path = this.filePath(key);
    if (!path || !this.api || !this.cacheDir) return;
    await this.api.ensureDirectory(this.cacheDir);
    await this.api.writeFile(path, JSON.stringify(entry, null, 2));
  }
}
