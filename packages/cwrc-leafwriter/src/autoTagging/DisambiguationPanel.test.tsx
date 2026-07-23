import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createAnchor } from './anchor';
import type { MentionGroup } from './mentions';
import * as disambiguationSettings from './disambiguationSettings';

const mockRankDisambiguationCandidates = jest.fn();
const mockBuildDisambiguationCandidates = jest.fn();
const mockAiApiSettingsFromDesktop = jest.fn();

jest.mock('./llmDisambiguationRank', () => ({
  rankDisambiguationCandidates: (...args: unknown[]) => mockRankDisambiguationCandidates(...args),
}));

jest.mock('./llmClientFromSettings', () => ({
  aiApiSettingsFromDesktop: () => mockAiApiSettingsFromDesktop(),
  createLlmClientFromSettings: () => ({ modelId: 'mock:model', complete: jest.fn() }),
  isAiSuggestReady: (settings: { baseUrl?: string; model?: string }) =>
    Boolean(settings?.baseUrl?.trim() && settings?.model?.trim()),
}));

jest.mock('./disambiguationCandidates', () => {
  const actual = jest.requireActual('./disambiguationCandidates');
  return {
    ...actual,
    buildDisambiguationCandidates: (...args: unknown[]) => mockBuildDisambiguationCandidates(...args),
    collapseCrossAuthorityCandidates: (rows: unknown[]) => rows,
    enrichCandidateCrossRefs: (row: unknown) => row,
  };
});

jest.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: unknown[];
    itemContent: (index: number, row: unknown) => ReactNode;
  }) => <div>{data.map((row, index) => <div key={index}>{itemContent(index, row)}</div>)}</div>,
}));

import { DisambiguationPanel } from './DisambiguationPanel';

function createGroup(): MentionGroup {
  const doc = new DOMParser().parseFromString(
    '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><persName>沈攸之</persName></p></body></text></TEI>',
    'application/xml',
  );
  const element = doc.getElementsByTagName('persName')[0]!;
  const textNode = element.firstChild as Text;
  const anchor = createAnchor('doc-1', doc, textNode, 0, textNode.data.length, 'ignore');
  return {
    tag: 'persName',
    surface: '沈攸之',
    fullyResolved: false,
    instances: [
      {
        documentId: 'doc-1',
        tag: 'persName',
        surface: '沈攸之',
        element,
        anchor,
        hasKey: false,
        isUnresolved: true,
      },
    ],
  };
}

function createSession() {
  const entitiesDoc = new DOMParser().parseFromString(
    '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body/></text></TEI>',
    'application/xml',
  );
  return {
    getPendingCandidates: jest.fn().mockReturnValue(null),
    rememberPendingCandidates: jest.fn(),
    savePendingCache: jest.fn().mockResolvedValue(undefined),
    loadEntities: jest.fn().mockResolvedValue(entitiesDoc),
    getEntitiesDocument: jest.fn().mockReturnValue(entitiesDoc),
    cache: { throttle: jest.fn().mockResolvedValue(undefined) },
    disambiguationAiCache: null,
    getDocument: jest.fn().mockResolvedValue(entitiesDoc),
    candidateSearchCentralContext: jest.fn().mockResolvedValue(null),
  } as any;
}

describe('DisambiguationPanel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    mockBuildDisambiguationCandidates.mockResolvedValue([
      {
        id: 'cbdb:1',
        label: '沈攸之',
        description: 'CBDB person',
        sources: ['CBDB'],
        uri: 'https://cbdb.fas.harvard.edu/person?id=1',
        authorityIds: [],
      },
    ]);
    mockAiApiSettingsFromDesktop.mockReturnValue(null);
    mockRankDisambiguationCandidates.mockResolvedValue({
      selectedCandidateIds: ['cbdb:1'],
      rationales: { 'cbdb:1': 'Best match' },
      confidences: { 'cbdb:1': 0.91 },
      suggestCreateNew: false,
    });
  });

  it('applies AI curation results back into the panel', async () => {
    render(<DisambiguationPanel session={createSession()} groups={[createGroup()]} aiCuration />);

    mockAiApiSettingsFromDesktop.mockReturnValue({
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'mock-model',
    });
    window.dispatchEvent(new Event('ljbCommonsUiChanged'));

    await waitFor(() => expect(mockRankDisambiguationCandidates).toHaveBeenCalled());
    expect(mockRankDisambiguationCandidates.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        candidates: expect.arrayContaining([
          expect.objectContaining({ id: 'cbdb:1', label: '沈攸之' }),
        ]),
      }),
    );
    expect(await screen.findByText('AI pre-selected 1 candidate.')).toBeTruthy();
  });

  it('bypasses saved caches when disambiguation caching is disabled', async () => {
    jest
      .spyOn(disambiguationSettings, 'readPersistedDisambiguationSettings')
      .mockReturnValue({ aiCuration: true, disableCaching: true });

    const session = createSession();
    session.getPendingCandidates = jest.fn().mockReturnValue([
      {
        id: 'cached:1',
        label: 'cached row',
        sources: ['Wikidata'],
      },
    ]);
    session.disambiguationAiCache = { get: jest.fn(), set: jest.fn(), cacheKey: jest.fn() };

    render(<DisambiguationPanel session={session} groups={[createGroup()]} aiCuration />);

    mockAiApiSettingsFromDesktop.mockReturnValue({
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'mock-model',
    });
    window.dispatchEvent(new Event('ljbCommonsUiChanged'));

    await waitFor(() => expect(mockBuildDisambiguationCandidates).toHaveBeenCalled());
    await waitFor(() => expect(mockRankDisambiguationCandidates).toHaveBeenCalled());

    expect(session.getPendingCandidates).not.toHaveBeenCalled();
    expect(session.rememberPendingCandidates).not.toHaveBeenCalled();
    expect(session.savePendingCache).not.toHaveBeenCalled();
    expect(mockRankDisambiguationCandidates.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ cache: null }),
    );
  });

  it('shows when AI reviewed candidates but abstained', async () => {
    mockRankDisambiguationCandidates.mockResolvedValueOnce({
      selectedCandidateIds: [],
      rationales: {},
      confidences: {},
      suggestCreateNew: false,
    });

    render(<DisambiguationPanel session={createSession()} groups={[createGroup()]} aiCuration />);

    mockAiApiSettingsFromDesktop.mockReturnValue({
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'mock-model',
    });
    window.dispatchEvent(new Event('ljbCommonsUiChanged'));

    expect(await screen.findByText('AI reviewed these candidates and did not pre-select any.')).toBeTruthy();
  });
});
