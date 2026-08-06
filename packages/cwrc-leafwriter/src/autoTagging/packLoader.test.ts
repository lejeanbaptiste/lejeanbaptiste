import type { AuthorityCandidate } from './authority';
import { teiTagForCandidate } from './authority';
import {
  candidateIntersectsYearRange,
  candidatePassesDateFilter,
  countPackUniqueStrings,
  DATE_FILTER_LOOKUP_PAD_YEARS,
  dateFilterForLookup,
  mergePackCandidates,
  parseAuthorityNdjson,
  rationaleForCandidates,
} from './packLoader';
import { seedSuggestions, suggestionsFromSeedMatches } from './seed';

const person = (over: Partial<AuthorityCandidate> = {}): AuthorityCandidate => ({
  source: 'CBDB',
  authorityId: '1',
  kind: 'person',
  primaryName: '王安石',
  searchStrings: ['王安石'],
  metadata: { startYear: 1021, endYear: 1086, description: '王安石 (Wang Anshi, 1021–1086, 宋)' },
  ...over,
});

describe('parseAuthorityNdjson', () => {
  it('parses one candidate per line', () => {
    const ndjson = `${JSON.stringify(person())}\n${JSON.stringify(person({ authorityId: '2', primaryName: '李白', searchStrings: ['李白'] }))}\n`;
    expect(parseAuthorityNdjson(ndjson)).toHaveLength(2);
  });
});

describe('candidateIntersectsYearRange', () => {
  it('includes undated when hideUndated is false', () => {
    expect(
      candidateIntersectsYearRange(person({ metadata: {} }), {
        start: 600,
        end: 900,
      }),
    ).toBe(true);
  });

  it('excludes undated when hideUndated is true', () => {
    expect(
      candidateIntersectsYearRange(person({ metadata: {} }), {
        start: 600,
        end: 900,
        hideUndated: true,
      }),
    ).toBe(false);
  });

  it('always includes undated DILA places even when hideUndated is true', () => {
    expect(
      candidateIntersectsYearRange(
        person({
          source: 'DILA',
          authorityId: 'PL1',
          kind: 'place',
          primaryName: '襄陽',
          searchStrings: ['襄陽'],
          metadata: { description: '襄陽 (襄城區)' },
        }),
        { start: 25, end: 220, hideUndated: true },
      ),
    ).toBe(true);
  });

  it('checks interval overlap', () => {
    expect(
      candidateIntersectsYearRange(person(), { start: 1100, end: 1200 }),
    ).toBe(false);
    expect(
      candidateIntersectsYearRange(person(), { start: 1000, end: 1100 }),
    ).toBe(true);
  });
});

describe('office candidates tag as roleName', () => {
  it('teiTagForCandidate and seed pass use roleName', () => {
    const office: AuthorityCandidate = {
      source: 'CBDB',
      authorityId: '99',
      kind: 'office',
      primaryName: '參知政事',
      searchStrings: ['參知政事'],
      metadata: { teiTag: 'roleName', description: '參知政事 (Song)' },
    };
    expect(teiTagForCandidate(office)).toBe('roleName');

    const doc = new DOMParser().parseFromString(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>除參知政事。</p></body></text></TEI>`,
      'application/xml',
    );
    const matches = seedSuggestions(doc, [office], 'ignore');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.suggestion.tag).toBe('roleName');

    const suggestions = suggestionsFromSeedMatches(matches);
    expect(suggestions[0]!.source).toBe('authority');
    expect(suggestions[0]!.rationale).toContain('參知政事');
  });
});

describe('dateFilterForLookup', () => {
  it('leaves none / undefined alone', () => {
    expect(dateFilterForLookup(undefined)).toBeUndefined();
    expect(dateFilterForLookup({ mode: 'none', start: 500, end: 2000 })).toEqual({
      mode: 'none',
      start: 500,
      end: 2000,
    });
  });

  it('widens limit both ways and shifts exclude later by the pad', () => {
    const pad = DATE_FILTER_LOOKUP_PAD_YEARS;
    expect(dateFilterForLookup({ mode: 'limit', start: 400, end: 500 })).toEqual({
      mode: 'limit',
      start: 400 - pad,
      end: 500 + pad,
    });
    // UI shows exclude-from-500; lookup uses 600 so near-contemporaries stay in.
    expect(dateFilterForLookup({ mode: 'exclude', start: 500, end: 2000 })).toEqual({
      mode: 'exclude',
      start: 500 + pad,
      end: 2000,
    });
  });
});

describe('candidatePassesDateFilter', () => {
  it('limit keeps overlap and drops undated; exclude is the inverse', () => {
    const tang = person({
      authorityId: '2',
      primaryName: '李白',
      searchStrings: ['李白'],
      metadata: { startYear: 701, endYear: 762 },
    });
    const undated = person({ authorityId: '3', primaryName: '無年', searchStrings: ['無年'], metadata: {} });
    const limit = { mode: 'limit' as const, start: 600, end: 900 };
    const exclude = { mode: 'exclude' as const, start: 600, end: 900 };

    expect(candidatePassesDateFilter(tang, limit)).toBe(true);
    expect(candidatePassesDateFilter(undated, limit)).toBe(false);
    expect(candidatePassesDateFilter(tang, exclude)).toBe(false);
    expect(candidatePassesDateFilter(undated, exclude)).toBe(true);
  });

  it('exclude uses birth and mean dates instead of dropping on death date alone', () => {
    const diesLate = person({
      authorityId: '4',
      primaryName: '晚卒',
      searchStrings: ['晚卒'],
      metadata: { startYear: 550, endYear: 650 },
    });
    const meanTooLate = person({
      authorityId: '5',
      primaryName: '平均太晚',
      searchStrings: ['平均太晚'],
      metadata: { startYear: 550, endYear: 800 },
    });
    const bornTooLate = person({
      authorityId: '6',
      primaryName: '出生太晚',
      searchStrings: ['出生太晚'],
      metadata: { startYear: 651, endYear: 700 },
    });
    const exclude = { mode: 'exclude' as const, start: 600, end: 2000 };

    expect(candidatePassesDateFilter(diesLate, exclude)).toBe(true);
    expect(candidatePassesDateFilter(meanTooLate, exclude)).toBe(false);
    expect(candidatePassesDateFilter(bornTooLate, exclude)).toBe(false);
  });
});

describe('countPackUniqueStrings', () => {
  it('counts unique tag/surface pairs and applies year filter', () => {
    const ndjson = [
      JSON.stringify(person()),
      JSON.stringify(
        person({
          authorityId: '2',
          primaryName: '李白',
          searchStrings: ['李白', '李太白'],
          metadata: { startYear: 701, endYear: 762 },
        }),
      ),
      JSON.stringify(
        person({
          authorityId: '3',
          primaryName: ' undated ',
          searchStrings: ['無年'],
          metadata: {},
        }),
      ),
    ].join('\n');

    expect(countPackUniqueStrings(ndjson)).toEqual({ entities: 3, uniqueStrings: 4 });

    const tang = countPackUniqueStrings(ndjson, { mode: 'limit', start: 600, end: 900 });
    expect(tang).toEqual({ entities: 1, uniqueStrings: 2 });
  });
});

describe('mergePackCandidates', () => {
  it('merges and counts per pack', () => {
    const merged = mergePackCandidates([
      { packId: 'cbdb-persons', candidates: [person()] },
      { packId: 'dila-persons', candidates: [person({ source: 'DILA', authorityId: 'A1' })] },
    ]);
    expect(merged.candidates).toHaveLength(2);
    expect(merged.loaded['cbdb-persons']).toBe(1);
  });

  it('merges large packs without spread overflow', () => {
    const big = Array.from({ length: 50_000 }, (_, i) =>
      person({ authorityId: String(i), primaryName: `名${i}`, searchStrings: [`名${i}`] }),
    );
    expect(() =>
      mergePackCandidates([{ packId: 'cbdb-persons', candidates: big }]),
    ).not.toThrow();
    expect(mergePackCandidates([{ packId: 'cbdb-persons', candidates: big }]).candidates).toHaveLength(
      50_000,
    );
  });
});

describe('rationaleForCandidates', () => {
  it('uses description for unique hits', () => {
    expect(rationaleForCandidates([person()])).toContain('王安石');
  });

  it('appends DILA disambiguation notes', () => {
    const clue = rationaleForCandidates([
      person({
        source: 'DILA',
        authorityId: 'A009306',
        metadata: {
          description: '玄奘 (唐 — 譯經僧)',
          disambiguation: 'A010168(一行)',
        },
      }),
    ]);
    expect(clue).toContain('玄奘');
    expect(clue).toContain('not A010168');
  });
});
