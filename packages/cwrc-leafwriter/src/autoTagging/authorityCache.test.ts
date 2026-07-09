import { AuthorityCache } from './authorityCache';
import { clearGlobalAuthorityCacheForTests, getGlobalEntry } from './authorityCacheGlobal';
import type { AuthorityLookupResult } from '../types/authority';

const makeResult = (label: string): AuthorityLookupResult => ({
  label,
  uri: `https://example.test/${label}`,
});

describe('AuthorityCache', () => {
  it('returns memory hits within TTL', async () => {
    const cache = new AuthorityCache(null, null);
    await cache.set({
      authority: 'Wikidata',
      entityType: 'person',
      query: '張衡',
      fetchedAt: new Date().toISOString(),
      results: [makeResult('Zhang Heng')],
    });

    const hit = await cache.get('Wikidata', 'person', '張衡');
    expect(hit?.results).toHaveLength(1);
  });

  it('misses after TTL', async () => {
    const cache = new AuthorityCache(null, null);
    await cache.set({
      authority: 'Wikidata',
      entityType: 'person',
      query: 'old',
      fetchedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      results: [makeResult('stale')],
    });

    const hit = await cache.get('Wikidata', 'person', 'old');
    expect(hit).toBeNull();
  });

  it('throttles consecutive requests', async () => {
    const cache = new AuthorityCache(null, null);
    const start = Date.now();
    await cache.throttle();
    await cache.throttle();
    expect(Date.now() - start).toBeGreaterThanOrEqual(900);
  });

  describe('with enableGlobalCache', () => {
    afterEach(async () => {
      await clearGlobalAuthorityCacheForTests();
    });

    it('writes through to the global tier on set()', async () => {
      const cache = new AuthorityCache(null, null, { enableGlobalCache: true });
      await cache.set({
        authority: 'Wikidata',
        entityType: 'person',
        query: '王安石',
        fetchedAt: new Date().toISOString(),
        results: [makeResult('Wang Anshi')],
      });

      const globalHit = await getGlobalEntry('Wikidata', 'person', '王安石');
      expect(globalHit?.results).toHaveLength(1);
    });

    it('falls back to the global tier and backfills memory on a fresh instance', async () => {
      const writer = new AuthorityCache(null, null, { enableGlobalCache: true });
      await writer.set({
        authority: 'VIAF',
        entityType: 'person',
        query: 'shared-across-projects',
        fetchedAt: new Date().toISOString(),
        results: [makeResult('Shared')],
      });

      // A different instance (as if a different project's session) still finds it.
      const reader = new AuthorityCache(null, null, { enableGlobalCache: true });
      const hit = await reader.get('VIAF', 'person', 'shared-across-projects');
      expect(hit?.results).toHaveLength(1);
    });

    it('never touches the global tier when disabled (default)', async () => {
      const cache = new AuthorityCache(null, null);
      await cache.set({
        authority: 'Wikidata',
        entityType: 'person',
        query: 'local-only',
        fetchedAt: new Date().toISOString(),
        results: [makeResult('Local')],
      });

      const globalHit = await getGlobalEntry('Wikidata', 'person', 'local-only');
      expect(globalHit).toBeNull();
    });
  });
});
