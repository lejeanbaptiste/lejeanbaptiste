import {
  CBDB_CONCORDANCE_SOURCE,
  packIdsAffectConcordance,
  parseCbdbConcordanceAssociations,
  refreshCbdbConcordanceAfterPackLifecycle,
  refreshCbdbConcordanceSqliteDebounced,
  resetCbdbConcordanceRefreshGateForTests,
  type CbdbConcordanceRefreshStore,
} from './cbdbConcordance';
import type { ConcordanceImportResult } from './entityOps';

describe('parseCbdbConcordanceAssociations', () => {
  it('defaults source to CBDB when the pack row omits source', () => {
    const line = JSON.stringify({
      canonicalId: '31',
      mergedFromId: '98561',
      notes: 'same person',
    });
    expect(parseCbdbConcordanceAssociations(line)).toEqual([
      {
        source: CBDB_CONCORDANCE_SOURCE,
        canonicalId: '31',
        mergedFromId: '98561',
        notes: 'same person',
      },
    ]);
  });

  it('ignores bibliographic source ids and still uses CBDB', () => {
    const line = JSON.stringify({
      canonicalId: '141',
      mergedFromId: '96120',
      source: '32053',
      notes: 'match',
    });
    expect(parseCbdbConcordanceAssociations([line])).toEqual([
      {
        source: 'CBDB',
        canonicalId: '141',
        mergedFromId: '96120',
        notes: 'match',
      },
    ]);
  });

  it('skips malformed lines and rows missing ids', () => {
    const content = [
      'not-json',
      JSON.stringify({ canonicalId: '1' }),
      JSON.stringify({ canonicalId: '55', mergedFromId: '468758' }),
    ].join('\n');
    expect(parseCbdbConcordanceAssociations(content)).toEqual([
      {
        source: 'CBDB',
        canonicalId: '55',
        mergedFromId: '468758',
      },
    ]);
  });
});

describe('packIdsAffectConcordance', () => {
  it('treats empty or omitted pack lists as refresh-needed (profile bundles)', () => {
    expect(packIdsAffectConcordance(undefined)).toBe(true);
    expect(packIdsAffectConcordance([])).toBe(true);
  });

  it('is true when cbdb-concordance is among the packs', () => {
    expect(packIdsAffectConcordance(['cbdb-persons', 'cbdb-concordance'])).toBe(true);
  });

  it('is false when the listed packs cannot affect concordance', () => {
    expect(packIdsAffectConcordance(['cbdb-persons', 'dila-places'])).toBe(false);
  });
});

describe('refreshCbdbConcordance after pack lifecycle', () => {
  const emptyResult: ConcordanceImportResult = {
    applied: 0,
    alreadyPresent: 0,
    rejected: 0,
    unresolved: 0,
    conflicts: [],
  };

  beforeEach(() => {
    resetCbdbConcordanceRefreshGateForTests();
  });

  const makeStore = (): CbdbConcordanceRefreshStore & {
    applyCalls: number;
  } => {
    const store = {
      sqlitePath: '/tmp/project/entities.sqlite',
      applyCalls: 0,
      hasSqliteDatabase: async () => true,
      sqliteApplyConcordance: async () => {
        store.applyCalls += 1;
        return emptyResult;
      },
    };
    return store;
  };

  const readPack = async () => JSON.stringify({ canonicalId: '31', mergedFromId: '98561' });

  it('calls refresh on the resolved store after pack lifecycle', async () => {
    const store = makeStore();
    const result = await refreshCbdbConcordanceAfterPackLifecycle({
      resolveStore: () => store,
      readPack,
    });
    expect(result).toEqual(emptyResult);
    expect(store.applyCalls).toBe(1);
  });

  it('skips when pack ids cannot affect concordance', async () => {
    const store = makeStore();
    const result = await refreshCbdbConcordanceAfterPackLifecycle({
      resolveStore: () => store,
      readPack,
      packIds: ['cbdb-persons'],
    });
    expect(result).toBeNull();
    expect(store.applyCalls).toBe(0);
  });

  it('debounces a follow-up panel-style refresh after pack lifecycle', async () => {
    const store = makeStore();
    const first = await refreshCbdbConcordanceAfterPackLifecycle({
      resolveStore: () => store,
      readPack,
    });
    expect(store.applyCalls).toBe(1);

    const reused = await refreshCbdbConcordanceSqliteDebounced(store, readPack, {
      force: false,
      clearCache: false,
      now: Date.now(),
      debounceMs: 15_000,
    });
    expect(reused).toEqual(first);
    expect(store.applyCalls).toBe(1);
  });

  it('force refresh still runs inside the debounce window (backfill)', async () => {
    const store = makeStore();
    await refreshCbdbConcordanceAfterPackLifecycle({
      resolveStore: () => store,
      readPack,
    });
    const forced = await refreshCbdbConcordanceSqliteDebounced(store, readPack, {
      force: true,
      clearCache: false,
    });
    expect(forced).toEqual(emptyResult);
    expect(store.applyCalls).toBe(2);
  });

  it('coalesces concurrent refreshes for the same database path', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = makeStore();
    store.sqliteApplyConcordance = async () => {
      store.applyCalls += 1;
      await gate;
      return emptyResult;
    };

    const first = refreshCbdbConcordanceSqliteDebounced(store, readPack, { force: true });
    const second = refreshCbdbConcordanceSqliteDebounced(store, readPack, { force: true });
    release();
    await Promise.all([first, second]);
    expect(store.applyCalls).toBe(1);
  });
});
