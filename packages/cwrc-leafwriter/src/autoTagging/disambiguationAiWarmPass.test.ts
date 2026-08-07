import type { AuthorityCache } from './authorityCache';
import type { DisambiguationAiCache } from './disambiguationAiCache';
import { buildDisambiguationCandidates, type DisambiguationCandidate } from './disambiguationCandidates';
import {
  runDisambiguationAiWarmPass,
  type DisambiguationAiWarmPassSession,
} from './disambiguationAiWarmPass';
import { rankDisambiguationCandidates } from './llmDisambiguationRank';
import type { LlmClient } from './llmClient';
import type { MentionGroup, MentionInstance } from './mentions';

jest.mock('./disambiguationCandidates', () => ({
  buildDisambiguationCandidates: jest.fn(),
}));

jest.mock('./llmDisambiguationRank', () => ({
  rankDisambiguationCandidates: jest.fn(),
}));

jest.mock('../services/authority-pack-lookup', () => ({
  cachedPackReader: () => jest.fn(),
}));

const mockBuild = buildDisambiguationCandidates as jest.MockedFunction<typeof buildDisambiguationCandidates>;
const mockRank = rankDisambiguationCandidates as jest.MockedFunction<typeof rankDisambiguationCandidates>;

function makeInstance(): MentionInstance {
  return {
    documentId: 'doc1',
    tag: 'persName',
    surface: '王安石',
    element: {} as Element,
    anchor: {} as MentionInstance['anchor'],
    hasKey: false,
    isUnresolved: true,
  };
}

function makeGroup(surface: string, overrides: Partial<MentionGroup> = {}): MentionGroup {
  return { tag: 'persName', surface, instances: [makeInstance()], fullyResolved: false, ...overrides };
}

function makeCandidates(label: string): DisambiguationCandidate[] {
  return [{ id: label, label, sources: ['Wikidata'] }];
}

function makeSession(
  options: { hasCache?: boolean; hasAiCache?: boolean; seedPending?: Record<string, DisambiguationCandidate[]> } = {},
): DisambiguationAiWarmPassSession {
  const { hasCache = true, hasAiCache = true, seedPending = {} } = options;
  const doc = {} as Document;
  const pendingEntries = new Map<string, DisambiguationCandidate[]>(Object.entries(seedPending));

  return {
    cache: hasCache ? ({} as AuthorityCache) : null,
    dilaPlaceDetailCache: null,
    disambiguationAiCache: hasAiCache ? ({} as DisambiguationAiCache) : null,
    getDocument: async () => doc,
    getPendingCandidates: (tag, surface) => pendingEntries.get(`${tag}\0${surface}`) ?? null,
    disambiguationDbSources: async () => ({ local: [], entitiesDoc: doc }),
  };
}

describe('runDisambiguationAiWarmPass', () => {
  beforeEach(() => {
    mockBuild.mockReset();
    mockRank.mockReset();
    delete (window as unknown as { __leafWriterProject?: unknown }).__leafWriterProject;
  });

  it('is a no-op when there is no AI ranking cache', async () => {
    const session = makeSession({ hasAiCache: false });
    await runDisambiguationAiWarmPass(session, [makeGroup('王安石')], {
      client: {} as LlmClient,
    });
    expect(mockRank).not.toHaveBeenCalled();
  });

  it('is a no-op when there is no authority cache', async () => {
    const session = makeSession({ hasCache: false });
    await runDisambiguationAiWarmPass(session, [makeGroup('王安石')], {
      client: {} as LlmClient,
    });
    expect(mockRank).not.toHaveBeenCalled();
  });

  it('skips already-resolved groups and groups with no instances', async () => {
    const session = makeSession();
    await runDisambiguationAiWarmPass(
      session,
      [makeGroup('resolved', { fullyResolved: true }), makeGroup('empty', { instances: [] })],
      { client: {} as LlmClient },
    );
    expect(mockRank).not.toHaveBeenCalled();
  });

  it('builds candidates when nothing is pending, then ranks each group', async () => {
    mockBuild.mockResolvedValue(makeCandidates('cbdb:1'));
    mockRank.mockResolvedValue(null);
    const session = makeSession();
    const client = {} as LlmClient;

    await runDisambiguationAiWarmPass(session, [makeGroup('王安石'), makeGroup('司馬光')], {
      client,
    });

    expect(mockBuild).toHaveBeenCalledTimes(2);
    expect(mockRank).toHaveBeenCalledTimes(2);
    expect(mockRank.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        candidates: makeCandidates('cbdb:1'),
        client,
      }),
    );
  });

  it('reuses already-pending candidates instead of rebuilding them', async () => {
    mockRank.mockResolvedValue(null);
    const session = makeSession({
      seedPending: { 'persName\0王安石': makeCandidates('cached:1') },
    });

    await runDisambiguationAiWarmPass(session, [makeGroup('王安石')], {
      client: {} as LlmClient,
    });

    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockRank.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ candidates: makeCandidates('cached:1') }),
    );
  });

  it('reports progress and stops early when aborted', async () => {
    mockBuild.mockResolvedValue(makeCandidates('cbdb:1'));
    mockRank.mockResolvedValue(null);
    const session = makeSession();
    const controller = new AbortController();
    const onProgress = jest.fn();
    controller.abort();

    await runDisambiguationAiWarmPass(session, [makeGroup('王安石')], {
      client: {} as LlmClient,
      signal: controller.signal,
      onProgress,
    });

    expect(mockRank).not.toHaveBeenCalled();
  });

  it('passes cache: null when disambiguation caching is disabled in settings', async () => {
    (window as unknown as { __leafWriterProject: unknown }).__leafWriterProject = {
      getDisambiguationSettings: () => ({ disableCaching: true }),
    };
    mockBuild.mockResolvedValue(makeCandidates('cbdb:1'));
    mockRank.mockResolvedValue(null);
    const session = makeSession();

    await runDisambiguationAiWarmPass(session, [makeGroup('王安石')], {
      client: {} as LlmClient,
    });

    expect(mockRank.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ cache: null }));
  });

  it('keeps going past a single group that fails', async () => {
    mockBuild.mockResolvedValue(makeCandidates('cbdb:1'));
    mockRank.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(null);
    const session = makeSession();

    await runDisambiguationAiWarmPass(session, [makeGroup('王安石'), makeGroup('司馬光')], {
      client: {} as LlmClient,
    });

    expect(mockRank).toHaveBeenCalledTimes(2);
  });
});
