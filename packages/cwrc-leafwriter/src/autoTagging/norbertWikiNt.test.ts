import type { AuthorityCandidate } from './authority';
import { buildNobleTitleSearchStrings, expandNorbertWikiNtCandidate } from './norbertWikiNt';
import { seedSuggestions, suggestionsFromSeedMatches } from './seed';

const candidate: AuthorityCandidate = {
  source: 'norbert-wikipedia',
  authorityId: 'wiki-nt:0001',
  kind: 'person',
  primaryName: '王瑊',
  searchStrings: ['江陽公', '江陽公王瑊'],
  names: [{ text: '王瑊', type: 'wrapper-person' }],
  metadata: {
    isNobleTitle: true,
    dynasty: '晉',
    nobleTitle: { fief: '江陽', roleName: '公' },
    wrapper: {
      personId: 'wikidata:Q45495174',
      titleRowId: 'wnt-0001',
      components: { fief: '江陽', roleName: '公', persName: '王瑊' },
    },
  },
};

describe('Norbert Wikipedia noble-title runtime', () => {
  it('uses an explicit posthumous abbreviation as an additional title form', () => {
    const abbreviated: AuthorityCandidate = {
      ...candidate,
      metadata: {
        ...candidate.metadata,
        nobleTitle: {
          fief: '宋',
          roleName: '帝',
          posthumousName: '孝武',
          posthumousNameAbbr: '武',
        },
      },
    };
    const title = expandNorbertWikiNtCandidate(abbreviated).find(
      (item) => item.metadata?.teiTag === 'nobleTitle',
    );
    expect(title?.searchStrings).toEqual(expect.arrayContaining(['宋孝武帝', '宋武帝']));
  });

  it('expands compact components into separate wrapper and title candidates', () => {
    const expanded = expandNorbertWikiNtCandidate(
      candidate,
      new Map([['wikidata:Q45495174', ['王瑊', '字玉山']]]),
    );
    const wrapper = expanded.find((item) => item.metadata?.wrapper);
    const title = expanded.find((item) => item.metadata?.teiTag === 'nobleTitle');

    expect(wrapper?.searchStrings).toEqual(
      expect.arrayContaining(['江陽公王瑊', '晉江陽公王瑊', '江陽公字玉山']),
    );
    expect(title?.searchStrings).toEqual(expect.arrayContaining(['江陽公', '晉江陽公']));
    expect(title?.metadata?.wrapper).toBeUndefined();
  });

  it('renders a standalone title separately from a person wrapper', () => {
    const titleDoc = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>江陽公</p></body></text></TEI>',
      'application/xml',
    );
    const wrapperDoc = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>江陽公王瑊</p></body></text></TEI>',
      'application/xml',
    );
    const titleSuggestions = suggestionsFromSeedMatches(
      seedSuggestions(titleDoc, expandNorbertWikiNtCandidate(candidate), 'ignore'),
    );
    const wrapperSuggestions = suggestionsFromSeedMatches(
      seedSuggestions(wrapperDoc, expandNorbertWikiNtCandidate(candidate), 'ignore'),
    );

    // Keep this assertion close to the runtime boundary: the title candidate
    // must be represented independently of the longer wrapper candidate.
    expect(
      expandNorbertWikiNtCandidate(candidate).map((item) => [
        item.metadata?.teiTag,
        item.searchStrings,
      ]),
    ).toEqual(expect.arrayContaining([['nobleTitle', expect.arrayContaining(['江陽公'])]]));

    expect(
      wrapperSuggestions.some((item) => item.tag === 'name' && item.innerXml?.includes('王瑊')),
    ).toBe(true);
    expect(
      titleSuggestions.some((item) => item.tag === 'nobleTitle' && item.innerXml?.includes('江陽')),
    ).toBe(true);
  });
});

describe('buildNobleTitleSearchStrings — heir apparent and consort forms', () => {
  it('adds a 皇-prefixed form for 太子 alongside the bare fief-less form', () => {
    const { wrapperSearchStrings } = buildNobleTitleSearchStrings({
      roleName: '太子',
      personNames: ['勇'],
    });
    expect(wrapperSearchStrings).toEqual(expect.arrayContaining(['太子勇', '皇太子勇']));
  });

  it('does not add a 皇-prefixed form for ranks other than 太子', () => {
    const { wrapperSearchStrings } = buildNobleTitleSearchStrings({
      fief: '江陽',
      roleName: '公',
      personNames: ['王瑊'],
    });
    expect(wrapperSearchStrings).not.toEqual(expect.arrayContaining(['皇公王瑊']));
  });

  it('adds 皇+rank+surname+氏 for 太后/太妃 when a family name is given', () => {
    const { wrapperSearchStrings } = buildNobleTitleSearchStrings({
      roleName: '太后',
      familyName: '常',
    });
    expect(wrapperSearchStrings).toEqual(expect.arrayContaining(['皇太后常氏']));
  });

  it('omits the consort form without a family name', () => {
    const { wrapperSearchStrings } = buildNobleTitleSearchStrings({ roleName: '太后' });
    expect(wrapperSearchStrings).toHaveLength(0);
  });

  it('omits the consort form for ranks other than 太后/太妃', () => {
    const { wrapperSearchStrings } = buildNobleTitleSearchStrings({
      roleName: '王',
      familyName: '常',
    });
    expect(wrapperSearchStrings).not.toEqual(expect.arrayContaining(['皇王常氏']));
  });
});

describe('expandNorbertWikiNtCandidate — family name threading', () => {
  it('reads a typed family-name entry off the candidate to feed the consort form', () => {
    const consort: AuthorityCandidate = {
      source: 'norbert-wikipedia',
      authorityId: 'wiki-nt:0002',
      kind: 'person',
      primaryName: '常氏',
      searchStrings: ['皇太后常氏'],
      names: [{ text: '常', type: 'family' }],
      metadata: {
        isNobleTitle: true,
        nobleTitle: { roleName: '太后' },
        wrapper: {
          personId: 'norbert:person-5',
          titleRowId: 'wnt-0002',
          components: { roleName: '太后', persName: '常氏' },
        },
      },
    };
    const wrapper = expandNorbertWikiNtCandidate(consort).find((item) => item.metadata?.wrapper);
    expect(wrapper?.searchStrings).toEqual(expect.arrayContaining(['皇太后常氏']));
  });
});
