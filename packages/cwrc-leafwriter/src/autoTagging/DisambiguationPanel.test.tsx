import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createAnchor } from './anchor';
import type { MentionGroup } from './mentions';
import * as disambiguationSettings from './disambiguationSettings';

const mockRankDisambiguationCandidates = jest.fn();
const mockBuildDisambiguationCandidates = jest.fn();
const mockAiApiSettingsFromDesktop = jest.fn();

jest.mock('./llmDisambiguationRank', () => ({
  lookupCachedDisambiguationRank: jest.fn().mockResolvedValue(null),
  rankDisambiguationCandidates: (...args: unknown[]) => mockRankDisambiguationCandidates(...args),
}));

jest.mock('./llmClientFromSettings', () => ({
  aiApiSettingsFromDesktop: () => mockAiApiSettingsFromDesktop(),
  createLlmClientFromSettings: () => ({ modelId: 'mock:model', complete: jest.fn() }),
  isAiSuggestReady: (settings: { baseUrl?: string; model?: string }) =>
    Boolean(settings?.baseUrl?.trim() && settings?.model?.trim()),
}));

const mockSetDisambiguationAiCuration = jest.fn();

// The full overmind tree pulls in ESM-only deps (nanoid) that jest can't
// transform — mock the same as TranslationPane's substitute*.test.ts files.
jest.mock('../overmind', () => ({
  useActions: () => ({ ui: { setDisambiguationAiCuration: mockSetDisambiguationAiCuration } }),
  useAppState: () => ({ ui: { disambiguationReview: { active: false, aiCuration: false } } }),
}));

jest.mock('./disambiguationCandidates', () => {
  const actual = jest.requireActual('./disambiguationCandidates');
  return {
    ...actual,
    buildDisambiguationCandidates: (...args: unknown[]) =>
      mockBuildDisambiguationCandidates(...args),
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
  }) => (
    <div>
      {data.map((row, index) => (
        <div key={index}>{itemContent(index, row)}</div>
      ))}
    </div>
  ),
}));

// The real component (and maplibre-gl underneath it) is covered by
// PlaceComparisonMap.test.tsx — mocked here so this file never has to load
// the ESM-only maplibre-gl package, and so tests can assert the panel wires
// the right pins/title through without rendering an actual map.
jest.mock('./mapView/PlaceComparisonMap', () => ({
  PlaceComparisonMap: ({ open, pins, title }: { open: boolean; pins: unknown[]; title: string }) =>
    open ? (
      <div data-testid="place-comparison-map">
        {title} ({pins.length} pins)
      </div>
    ) : null,
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

/** A title mentioned with no name attached — empty, keyless identity persName. */
function createBareTitleGroup(): MentionGroup {
  const doc = new DOMParser().parseFromString(
    '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>' +
      '<name type="personWrapper" cert="unknown">' +
      '<nobleTitle><placeName>建安</placeName><roleName>王</roleName></nobleTitle>' +
      '<persName/>' +
      '</name></p></body></text></TEI>',
    'application/xml',
  );
  const element = doc.getElementsByTagName('name')[0]!;
  const textNode = element.getElementsByTagName('placeName')[0]!.firstChild as Text;
  const anchor = createAnchor('doc-1', doc, textNode, 0, textNode.data.length, 'ignore');
  return {
    tag: 'name',
    surface: '建安王',
    fullyResolved: false,
    instances: [
      {
        documentId: 'doc-1',
        tag: 'name',
        surface: '建安王',
        element,
        anchor,
        hasKey: false,
        isUnresolved: true,
      },
    ],
  };
}

function createPlaceGroup(surface = '竟陵'): MentionGroup {
  const doc = new DOMParser().parseFromString(
    `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><placeName>${surface}</placeName></p></body></text></TEI>`,
    'application/xml',
  );
  const element = doc.getElementsByTagName('placeName')[0]!;
  const textNode = element.firstChild as Text;
  const anchor = createAnchor('doc-1', doc, textNode, 0, textNode.data.length, 'ignore');
  return {
    tag: 'placeName',
    surface,
    fullyResolved: false,
    instances: [
      {
        documentId: 'doc-1',
        tag: 'placeName',
        surface,
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
    disambiguationDbSources: jest.fn().mockResolvedValue({
      local: [],
      entitiesDoc,
    }),
    titleOnlyDisambiguationCandidates: jest.fn().mockResolvedValue([]),
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

  it('shows authority candidates while AI curation is still running', async () => {
    let resolveRank: (value: unknown) => void = () => {};
    mockRankDisambiguationCandidates.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRank = resolve;
        }),
    );

    render(<DisambiguationPanel session={createSession()} groups={[createGroup()]} aiCuration />);

    mockAiApiSettingsFromDesktop.mockReturnValue({
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'mock-model',
    });
    window.dispatchEvent(new Event('ljbCommonsUiChanged'));

    expect((await screen.findAllByText('沈攸之')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(/AI is curating candidates/i)).toBeTruthy());

    resolveRank({
      selectedCandidateIds: ['cbdb:1'],
      rationales: { 'cbdb:1': 'Best match' },
      confidences: { 'cbdb:1': 0.91 },
      suggestCreateNew: false,
    });

    expect(await screen.findByText('AI pre-selected 1 candidate.')).toBeTruthy();
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

  it('AI toggle flips the overmind setter and persists the preference', async () => {
    const persistSpy = jest
      .spyOn(disambiguationSettings, 'persistDisambiguationSettings')
      .mockResolvedValue(undefined);
    jest
      .spyOn(disambiguationSettings, 'readPersistedDisambiguationSettings')
      .mockReturnValue({ aiCuration: false });

    render(<DisambiguationPanel session={createSession()} groups={[createGroup()]} />);

    const toggle = await screen.findByRole('button', { name: /AI curation is off/i });
    toggle.click();

    expect(mockSetDisambiguationAiCuration).toHaveBeenCalledWith(true);
    await waitFor(() =>
      expect(persistSpy).toHaveBeenCalledWith(expect.objectContaining({ aiCuration: true })),
    );
  });

  it('AI toggle is disabled and forced on when "Always on" is set', async () => {
    mockAiApiSettingsFromDesktop.mockReturnValue({
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'mock-model',
      alwaysOn: true,
    });

    render(<DisambiguationPanel session={createSession()} groups={[createGroup()]} />);

    const toggle = await screen.findByRole('button', { name: /AI curation is always on/i });
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
  });

  it('queries fief+role candidates for a title mentioned with no name, and shows the results', async () => {
    mockBuildDisambiguationCandidates.mockResolvedValue([]);
    const session = createSession();
    session.titleOnlyDisambiguationCandidates = jest.fn().mockResolvedValue([
      {
        id: 'p1',
        label: '劉休仁',
        sources: ['entity-file'],
        localEntityId: 'p1',
        fromEntityFile: true,
      },
    ]);

    render(<DisambiguationPanel session={session} groups={[createBareTitleGroup()]} />);

    expect(await screen.findByText('劉休仁')).toBeTruthy();
    expect(session.titleOnlyDisambiguationCandidates).toHaveBeenCalledWith('建安', '王');
    // The wrapper's identity persName is empty by design for a bare title —
    // there's no inner person name to disambiguate first, so this warning
    // (meant for a wrapper whose identity has a real, unresolved name) must
    // not appear here.
    expect(screen.queryByText(/Disambiguate the inner person name first/)).toBeNull();
  });

  it('does not query fief+role candidates for an ordinary named mention', async () => {
    const session = createSession();
    render(<DisambiguationPanel session={session} groups={[createGroup()]} />);

    await screen.findAllByText('沈攸之');
    expect(session.titleOnlyDisambiguationCandidates).not.toHaveBeenCalled();
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

    expect(
      await screen.findByText('AI reviewed these candidates and did not pre-select any.'),
    ).toBeTruthy();
  });

  it('labels geographically distinct place candidates with cluster letters, and ungeo\'d ones as "no geo data"', async () => {
    mockBuildDisambiguationCandidates.mockResolvedValue([
      { id: 'cbdb:a', label: '竟陵', sources: ['CBDB'], geo: { lat: 30.65, lon: 113.15 } },
      { id: 'chgis:b', label: '竟陵', sources: ['CHGIS'], geo: { lat: 39.9, lon: 116.4 } }, // ~1000km away
      { id: 'dila:c', label: '竟陵', sources: ['DILA'] }, // no geo
    ]);
    mockRankDisambiguationCandidates.mockResolvedValue({
      selectedCandidateIds: [],
      rationales: {},
      confidences: {},
      suggestCreateNew: false,
    });

    render(
      <DisambiguationPanel
        session={createSession()}
        groups={[createPlaceGroup()]}
        aiCuration={false}
      />,
    );

    expect(await screen.findByText('A')).toBeTruthy();
    expect(await screen.findByText('B')).toBeTruthy();
    expect(await screen.findByText('no geo data')).toBeTruthy();
  });

  it('still badges a single geo-bearing place candidate, even with nothing else to disambiguate against', async () => {
    mockBuildDisambiguationCandidates.mockResolvedValue([
      { id: 'cbdb:a', label: '竟陵', sources: ['CBDB'], geo: { lat: 30.65, lon: 113.15 } },
    ]);
    mockRankDisambiguationCandidates.mockResolvedValue({
      selectedCandidateIds: [],
      rationales: {},
      confidences: {},
      suggestCreateNew: false,
    });

    render(
      <DisambiguationPanel
        session={createSession()}
        groups={[createPlaceGroup()]}
        aiCuration={false}
      />,
    );

    await waitFor(() => expect(mockBuildDisambiguationCandidates).toHaveBeenCalled());
    expect(await screen.findByText('A')).toBeTruthy();
    expect(screen.queryByText('no geo data')).toBeNull();
  });

  it('renders a single row for an already-merged geo-cluster candidate', async () => {
    // Simulates what buildDisambiguationCandidates now returns once geo-cluster
    // merging (WP1) has folded a CBDB + CHGIS hit into one row — the panel
    // itself does no merging, it just renders whatever it's given.
    mockBuildDisambiguationCandidates.mockResolvedValue([
      {
        id: 'cbdb:a',
        label: '竟陵',
        sources: ['CBDB', 'CHGIS'],
        geo: { lat: 30.651, lon: 113.151 },
      },
    ]);
    mockRankDisambiguationCandidates.mockResolvedValue({
      selectedCandidateIds: [],
      rationales: {},
      confidences: {},
      suggestCreateNew: false,
    });

    render(
      <DisambiguationPanel
        session={createSession()}
        groups={[createPlaceGroup()]}
        aiCuration={false}
      />,
    );

    await waitFor(() => expect(mockBuildDisambiguationCandidates).toHaveBeenCalled());
    expect(await screen.findAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByLabelText('Sources: CBDB+CHGIS')).toBeTruthy();
  });

  it('shows a map icon only on group headers whose background prefetch cache already has ≥2 geo clusters', async () => {
    mockBuildDisambiguationCandidates.mockResolvedValue([]);
    mockRankDisambiguationCandidates.mockResolvedValue({
      selectedCandidateIds: [],
      rationales: {},
      confidences: {},
      suggestCreateNew: false,
    });

    const session = createSession();
    session.getPendingCandidates.mockImplementation((tag: string, surface: string) => {
      if (surface !== '甲') return null;
      return [
        { id: 'cbdb:a', label: '甲', sources: ['CBDB'], geo: { lat: 30.65, lon: 113.15 } },
        { id: 'chgis:b', label: '甲', sources: ['CHGIS'], geo: { lat: 39.9, lon: 116.4 } }, // ~1000km away
      ];
    });

    render(
      <DisambiguationPanel
        session={session}
        groups={[createPlaceGroup('甲'), createPlaceGroup('乙')]}
        aiCuration={false}
      />,
    );

    expect(await screen.findByLabelText('Compare 甲 on map')).toBeTruthy();
    expect(screen.queryByLabelText('Compare 乙 on map')).toBeNull();
  });

  it('opens the comparison map with one pin per cluster when the group-header icon is clicked', async () => {
    mockBuildDisambiguationCandidates.mockResolvedValue([]);
    mockRankDisambiguationCandidates.mockResolvedValue({
      selectedCandidateIds: [],
      rationales: {},
      confidences: {},
      suggestCreateNew: false,
    });

    const session = createSession();
    session.getPendingCandidates.mockReturnValue([
      { id: 'cbdb:a', label: '甲', sources: ['CBDB'], geo: { lat: 30.65, lon: 113.15 } },
      { id: 'chgis:b', label: '甲', sources: ['CHGIS'], geo: { lat: 39.9, lon: 116.4 } },
    ]);

    render(
      <DisambiguationPanel
        session={session}
        groups={[createPlaceGroup('甲')]}
        aiCuration={false}
      />,
    );

    (await screen.findByLabelText('Compare 甲 on map')).click();

    const mapDialog = await screen.findByTestId('place-comparison-map');
    expect(mapDialog.textContent).toContain('甲 — compare clusters');
    expect(mapDialog.textContent).toContain('2 pins');
  });
});
