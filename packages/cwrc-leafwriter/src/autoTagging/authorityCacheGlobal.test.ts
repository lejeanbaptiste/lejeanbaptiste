import {
  clearGlobalAuthorityCacheForTests,
  getGlobalEntry,
  MAX_ENTRIES,
  setGlobalEntry,
} from './authorityCacheGlobal';
import type { AuthorityLookupResult } from '../types/authority';

const makeResult = (label: string): AuthorityLookupResult => ({
  label,
  uri: `https://example.test/${label}`,
});

describe('authorityCacheGlobal', () => {
  afterEach(async () => {
    await clearGlobalAuthorityCacheForTests();
  });

  it('returns a hit within TTL', async () => {
    await setGlobalEntry({
      authority: 'Wikidata',
      entityType: 'person',
      query: '張衡',
      fetchedAt: new Date().toISOString(),
      results: [makeResult('Zhang Heng')],
    });

    const hit = await getGlobalEntry('Wikidata', 'person', '張衡');
    expect(hit?.results).toHaveLength(1);
    expect(hit?.results[0]?.label).toBe('Zhang Heng');
  });

  it('misses on an unknown key', async () => {
    const hit = await getGlobalEntry('Wikidata', 'person', 'nobody');
    expect(hit).toBeNull();
  });

  it('misses after TTL', async () => {
    await setGlobalEntry({
      authority: 'Wikidata',
      entityType: 'person',
      query: 'old',
      fetchedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      results: [makeResult('stale')],
    });

    const hit = await getGlobalEntry('Wikidata', 'person', 'old');
    expect(hit).toBeNull();
  });

  it('evicts the oldest-accessed rows once the entry cap is exceeded', async () => {
    // Eviction only re-checks every 20 writes, so drive enough writes past the
    // cap to guarantee at least one eviction pass has run.
    const total = MAX_ENTRIES + 41;
    for (let i = 0; i < total; i++) {
      await setGlobalEntry({
        authority: 'Wikidata',
        entityType: 'person',
        query: `q${i}`,
        fetchedAt: new Date().toISOString(),
        results: [makeResult(`r${i}`)],
      });
    }

    // The very first entries written should have been evicted as the oldest by
    // lastAccessedAt; the most recent ones must still be present.
    const first = await getGlobalEntry('Wikidata', 'person', 'q0');
    const last = await getGlobalEntry('Wikidata', 'person', `q${total - 1}`);
    expect(first).toBeNull();
    expect(last).not.toBeNull();
  }, 30000);
});
