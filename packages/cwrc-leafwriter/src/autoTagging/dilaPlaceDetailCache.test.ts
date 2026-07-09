import { DilaPlaceDetailCache } from './dilaPlaceDetailCache';
import type { AuthorityCacheFileApi } from './authorityCache';

function memoryFileApi(): AuthorityCacheFileApi & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    readFile: async (path) => {
      const content = files.get(path);
      if (content == null) throw new Error(`not found: ${path}`);
      return content;
    },
    writeFile: async (path, content) => {
      files.set(path, content);
    },
    pathExists: async (path) => files.has(path),
    ensureDirectory: async () => {},
  };
}

describe('DilaPlaceDetailCache', () => {
  it('returns null with no backing store', async () => {
    const cache = new DilaPlaceDetailCache(null, null);
    expect(await cache.get('PL000000029418')).toBeNull();
  });

  it('round-trips through the in-memory layer', async () => {
    const cache = new DilaPlaceDetailCache(null, null);
    const detail = { remark: '（317 ~ 420）郡級行政中心所在地。', dynasty: '東晉', startYear: 317, endYear: 420 };
    await cache.set('PL000000029418', detail);
    expect(await cache.get('PL000000029418')).toEqual(detail);
  });

  it('persists to and reads back from the file api', async () => {
    const api = memoryFileApi();
    const cacheA = new DilaPlaceDetailCache(api, '/cache/dila-place-detail');
    const detail = { remark: '（317 ~ 420）郡級行政中心所在地。', dynasty: '東晉', startYear: 317, endYear: 420 };
    await cacheA.set('PL000000029418', detail);

    // Fresh instance (no in-memory hit) must read the persisted file.
    const cacheB = new DilaPlaceDetailCache(api, '/cache/dila-place-detail');
    expect(await cacheB.get('PL000000029418')).toEqual(detail);
  });

  it('misses for an id that was never cached', async () => {
    const api = memoryFileApi();
    const cache = new DilaPlaceDetailCache(api, '/cache/dila-place-detail');
    expect(await cache.get('PL000000000000')).toBeNull();
  });
});
