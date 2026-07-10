import type { AuthorityCache } from './authorityCache';
import { buildDisambiguationCandidates, type DisambiguationCandidate } from './disambiguationCandidates';
import { runAuthorityPrefetch, type AuthorityPrefetchSession } from './authorityPrefetch';
import type { MentionGroup } from './mentions';

jest.mock('./disambiguationCandidates', () => ({
  buildDisambiguationCandidates: jest.fn(),
}));

const mockBuild = buildDisambiguationCandidates as jest.MockedFunction<typeof buildDisambiguationCandidates>;

function makeGroup(surface: string, overrides: Partial<MentionGroup> = {}): MentionGroup {
  return { tag: 'persName', surface, instances: [], fullyResolved: false, ...overrides };
}

function makeCandidates(label: string): DisambiguationCandidate[] {
  return [{ id: label, label, sources: ['Wikidata'] }];
}

interface TestSession extends AuthorityPrefetchSession {
  savePendingCacheCalls: number;
  pendingEntries: Map<string, DisambiguationCandidate[]>;
}

function makeSession(options: { hasCache?: boolean; seedPending?: Record<string, DisambiguationCandidate[]> } = {}): TestSession {
  const { hasCache = true, seedPending = {} } = options;
  const doc = {} as Document;
  const pendingEntries = new Map<string, DisambiguationCandidate[]>(
    Object.entries(seedPending).map(([k, v]) => [k, v]),
  );

  const session: TestSession = {
    cache: hasCache ? ({} as AuthorityCache) : null,
    dilaPlaceDetailCache: null,
    getPendingCandidates: (tag, surface) => pendingEntries.get(`${tag}\0${surface}`) ?? null,
    rememberPendingCandidates: (tag, surface, candidates) => {
      pendingEntries.set(`${tag}\0${surface}`, candidates);
    },
    getEntitiesDocument: () => doc,
    loadEntities: async () => doc,
    savePendingCache: async () => {
      session.savePendingCacheCalls += 1;
    },
    savePendingCacheCalls: 0,
    pendingEntries,
  };
  return session;
}

describe('runAuthorityPrefetch', () => {
  beforeEach(() => {
    mockBuild.mockReset();
    jest.useFakeTimers();
    delete (window as unknown as { __leafWriterProject?: unknown }).__leafWriterProject;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is a no-op when disambiguation caching is disabled in settings', async () => {
    (window as unknown as { __leafWriterProject: unknown }).__leafWriterProject = {
      getDisambiguationSettings: () => ({ disableCaching: true }),
    };
    const session = makeSession();
    const handle = runAuthorityPrefetch(session, [makeGroup('王安石')]);

    await jest.advanceTimersByTimeAsync(5000);

    expect(mockBuild).not.toHaveBeenCalled();
    expect(() => handle.stop()).not.toThrow();
  });

  it('is a no-op when the session has no authority cache', async () => {
    const session = makeSession({ hasCache: false });
    runAuthorityPrefetch(session, [makeGroup('王安石')]);

    await jest.advanceTimersByTimeAsync(5000);

    expect(mockBuild).not.toHaveBeenCalled();
  });

  it('skips fully-resolved and already-pending groups', async () => {
    const session = makeSession({
      seedPending: { 'persName\0已解析': makeCandidates('cached') },
    });
    mockBuild.mockResolvedValue(makeCandidates('fresh'));

    runAuthorityPrefetch(session, [
      makeGroup('已解析'),
      makeGroup('已完成', { fullyResolved: true }),
      makeGroup('需要查找'),
    ]);

    await jest.advanceTimersByTimeAsync(1000);

    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(mockBuild).toHaveBeenCalledWith(
      expect.anything(),
      'persName',
      '需要查找',
      session.cache,
      ['Wikidata', 'VIAF'],
      false,
      undefined,
      undefined,
      undefined,
      expect.any(Function), // onDilaDatesReady: re-remember rows once lazy DILA scrapes land
    );
  });

  it('processes groups serially, one per idle tick, and remembers results', async () => {
    const session = makeSession();
    mockBuild.mockImplementation(async (_doc, _tag, surface) => makeCandidates(`result-${surface}`));

    runAuthorityPrefetch(session, [makeGroup('甲'), makeGroup('乙')]);

    await jest.advanceTimersByTimeAsync(200);
    await Promise.resolve();
    expect(session.pendingEntries.get('persName\0甲')).toEqual(makeCandidates('result-甲'));
    expect(mockBuild).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(200);
    await Promise.resolve();
    expect(session.pendingEntries.get('persName\0乙')).toEqual(makeCandidates('result-乙'));
    expect(mockBuild).toHaveBeenCalledTimes(2);
  });

  it('waits for the configured pace before each idle prefetch tick', async () => {
    const session = makeSession();
    mockBuild.mockResolvedValue(makeCandidates('r'));

    runAuthorityPrefetch(session, [makeGroup('甲')], { paceMs: 2_000 });

    await jest.advanceTimersByTimeAsync(2_199);
    expect(mockBuild).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    expect(mockBuild).toHaveBeenCalledTimes(1);
  });

  it('debounces savePendingCache and flushes it on stop()', async () => {
    const session = makeSession();
    mockBuild.mockResolvedValue(makeCandidates('r'));

    const handle = runAuthorityPrefetch(session, [makeGroup('甲')]);

    await jest.advanceTimersByTimeAsync(200);
    await Promise.resolve();
    expect(session.savePendingCacheCalls).toBe(0);

    handle.stop();
    await Promise.resolve();
    expect(session.savePendingCacheCalls).toBe(1);
  });

  it('stop() halts further processing of the queue', async () => {
    const session = makeSession();
    mockBuild.mockResolvedValue(makeCandidates('r'));

    const handle = runAuthorityPrefetch(session, [makeGroup('甲'), makeGroup('乙')]);

    await jest.advanceTimersByTimeAsync(200);
    await Promise.resolve();
    expect(mockBuild).toHaveBeenCalledTimes(1);

    handle.stop();
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockBuild).toHaveBeenCalledTimes(1);
  });

  it('passes no custom DILA fetch implementation, but re-remembers rows once scrapes land', async () => {
    const session = makeSession();
    mockBuild.mockResolvedValue(makeCandidates('r'));

    runAuthorityPrefetch(session, [makeGroup('甲')]);
    await jest.advanceTimersByTimeAsync(200);
    await Promise.resolve();

    const call = mockBuild.mock.calls[0]!;
    expect(call[8]).toBeUndefined(); // no dilaFetchImpl override
    expect(call[9]).toEqual(expect.any(Function)); // onDilaDatesReady refresh hook

    // Simulate the lazy DILA details landing: the callback must rebuild and
    // overwrite the remembered rows so the pending cache doesn't permanently
    // hold undated first-pass candidates.
    mockBuild.mockResolvedValue(makeCandidates('dated'));
    (call[9] as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    expect(session.pendingEntries.get('persName\0甲')).toEqual(makeCandidates('dated'));
  });
});
