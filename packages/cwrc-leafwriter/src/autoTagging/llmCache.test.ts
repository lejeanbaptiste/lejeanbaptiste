import { LlmCache, type LlmCacheFileApi, type RawLlmItem } from './llmCache';

const item: RawLlmItem = {
  surface: '張衡',
  occurrence: 1,
  tag: 'persName',
  action: 'add',
  confidence: 0.9,
  rationale: 'name',
};

function memoryFileApi(): LlmCacheFileApi & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    readFile: async (p) => {
      const v = files.get(p);
      if (v === undefined) throw new Error('not found');
      return v;
    },
    writeFile: async (p, c) => {
      files.set(p, c);
    },
    pathExists: async (p) => files.has(p),
    ensureDirectory: async () => {},
  };
}

describe('LlmCache', () => {
  it('misses when nothing is cached', async () => {
    const cache = new LlmCache(null, null);
    expect(await cache.get('chunk text', ['persName'], 'ollama:m', 'suggest.v1')).toBeNull();
  });

  it('hits in-memory after a set with identical key', async () => {
    const cache = new LlmCache(null, null);
    await cache.set('chunk text', ['persName'], 'ollama:m', 'suggest.v1', [item]);
    expect(await cache.get('chunk text', ['persName'], 'ollama:m', 'suggest.v1')).toEqual([item]);
  });

  it('is keyed on chunk text, tag set, model, and prompt version — any difference misses', async () => {
    const cache = new LlmCache(null, null);
    await cache.set('chunk text', ['persName'], 'ollama:m', 'suggest.v1', [item]);
    expect(await cache.get('different chunk', ['persName'], 'ollama:m', 'suggest.v1')).toBeNull();
    expect(await cache.get('chunk text', ['placeName'], 'ollama:m', 'suggest.v1')).toBeNull();
    expect(await cache.get('chunk text', ['persName'], 'mistral:m', 'suggest.v1')).toBeNull();
    expect(await cache.get('chunk text', ['persName'], 'ollama:m', 'suggest.v2')).toBeNull();
  });

  it('tag set order does not affect the key', async () => {
    const cache = new LlmCache(null, null);
    await cache.set('chunk text', ['persName', 'placeName'], 'ollama:m', 'suggest.v1', [item]);
    expect(await cache.get('chunk text', ['placeName', 'persName'], 'ollama:m', 'suggest.v1')).toEqual([item]);
  });

  it('persists to disk and reloads into a fresh instance', async () => {
    const api = memoryFileApi();
    const cache1 = new LlmCache(api, '/proj/.ljb/ai-cache');
    await cache1.set('chunk text', ['persName'], 'ollama:m', 'suggest.v1', [item]);

    const cache2 = new LlmCache(api, '/proj/.ljb/ai-cache');
    expect(await cache2.get('chunk text', ['persName'], 'ollama:m', 'suggest.v1')).toEqual([item]);
  });

  it('ignores a corrupt on-disk cache entry', async () => {
    const api = memoryFileApi();
    const cache = new LlmCache(api, '/proj/.ljb/ai-cache');
    await cache.set('chunk text', ['persName'], 'ollama:m', 'suggest.v1', [item]);
    for (const path of api.files.keys()) api.files.set(path, 'not json');

    const cache2 = new LlmCache(api, '/proj/.ljb/ai-cache');
    expect(await cache2.get('chunk text', ['persName'], 'ollama:m', 'suggest.v1')).toBeNull();
  });
});
