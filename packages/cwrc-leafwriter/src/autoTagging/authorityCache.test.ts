import { AuthorityCache } from './authorityCache';
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
});
