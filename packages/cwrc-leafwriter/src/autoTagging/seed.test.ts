import fs from 'fs';
import path from 'path';
import type { AuthorityCandidate } from './authority';
import { candidatesFromCsv } from './authority';
import { createEntitiesScaffold, parseEntities } from './entities';
import { normalizeDomText } from './normalize';
import { autoLinkUnique, bucketSeeds, seedSuggestions, suggestionsFromSeedMatches } from './seed';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const cand = (over: Partial<AuthorityCandidate> = {}): AuthorityCandidate => ({
  source: 'DPM',
  authorityId: '1',
  kind: 'person',
  primaryName: '張衡',
  searchStrings: ['張衡'],
  ...over,
});

const TEI = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p>張衡居洛陽，張衡造渾天儀。</p>
</body></text></TEI>`;

/** Find a minted entity by an authority idno value (ids are now UUIDs). */
const entityByAuthority = (entitiesDoc: Document, value: string): Element | null => {
  for (const idno of Array.from(entitiesDoc.getElementsByTagName('idno'))) {
    if (idno.textContent?.trim() === value) return idno.parentElement;
  }
  return null;
};

/** The @key written onto the first mention with the given surface text. */
const keyOfSurface = (doc: Document, surface: string): string | null => {
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (el.getAttribute('key') && el.textContent?.trim() === surface) return el.getAttribute('key');
  }
  return null;
};

describe('seedSuggestions + bucketSeeds', () => {
  it('attaches candidates and buckets unique vs ambiguous', () => {
    const doc = parse(TEI);
    const candidates = [
      cand({ authorityId: '1', searchStrings: ['張衡'] }),
      cand({ authorityId: '2', searchStrings: ['張衡'] }), // second 張衡 → ambiguous
      cand({ authorityId: '9', kind: 'place', primaryName: '洛陽', searchStrings: ['洛陽'] }),
    ];
    const matches = seedSuggestions(doc, candidates, 'ignore');

    // two 張衡 occurrences + one 洛陽
    expect(matches).toHaveLength(3);
    const { unique, ambiguous } = bucketSeeds(matches);
    expect(unique.map((m) => m.suggestion.anchor.surface)).toEqual(['洛陽']);
    expect(ambiguous).toHaveLength(2); // both 張衡 spots have 2 candidates
    expect(ambiguous[0]!.candidates).toHaveLength(2);
  });

  it('never shows the same source label twice in the pill even with near-identical raw values', () => {
    const doc = parse(TEI);
    const candidates = [
      cand({ source: 'CBDB', authorityId: '1', searchStrings: ['張衡'] }),
      cand({ source: 'CBDB ', authorityId: '2', searchStrings: ['張衡'] }), // trailing space
      cand({ source: 'cbdb', authorityId: '3', searchStrings: ['張衡'] }), // different case
    ];
    const matches = seedSuggestions(doc, candidates, 'ignore');
    const suggestions = suggestionsFromSeedMatches(matches);
    for (const s of suggestions.filter((s) => s.anchor.surface === '張衡')) {
      expect(s.sourceDetail).toBe('CBDB');
    }
  });
});

describe('autoLinkUnique', () => {
  it('mints entities and tags mentions with a key', async () => {
    const doc = parse(TEI);
    const entitiesDoc = parseEntities(createEntitiesScaffold());
    const candidates = [
      cand({ authorityId: 'p1', kind: 'person', primaryName: '張衡', searchStrings: ['張衡'] }),
      cand({ authorityId: 'pl9', kind: 'place', primaryName: '洛陽', searchStrings: ['洛陽'] }),
    ];
    const { unique } = bucketSeeds(seedSuggestions(doc, candidates, 'ignore'));

    const result = await autoLinkUnique(doc, entitiesDoc, unique, { policy: 'ignore' });
    expect(result.linked).toBe(unique.length);
    expect(result.entitiesCreated).toBe(2);

    // the place mention is tagged with the minted (UUID) key of the place entity
    const placeKey = keyOfSurface(doc, '洛陽');
    expect(placeKey).toMatch(/^place-[0-9a-f-]{36}$/);
    expect(entityByAuthority(entitiesDoc, 'pl9')?.getAttribute('xml:id')).toBe(placeKey);
    // the minted entity carries the authority idno
    const person = entityByAuthority(entitiesDoc, 'p1')!;
    expect(person.getElementsByTagName('idno')[0]?.textContent).toBe('p1');
    expect(person.getAttribute('resp')).toBe('#ljb-autotag');
  });

  it('writes xml:lang and a romanized name when a project language is supplied', async () => {
    const doc = parse(TEI);
    const entitiesDoc = parseEntities(createEntitiesScaffold());
    const candidates = [
      cand({
        authorityId: 'p1',
        primaryName: '張衡',
        searchStrings: ['張衡'],
        metadata: { pinyin: 'Zhang Heng' },
      }),
      cand({ authorityId: 'pl9', kind: 'place', primaryName: '洛陽', searchStrings: ['洛陽'] }),
    ];
    const { unique } = bucketSeeds(seedSuggestions(doc, candidates, 'ignore'));

    await autoLinkUnique(doc, entitiesDoc, unique, { policy: 'ignore' }, 'zh-Hant');

    const person = entityByAuthority(entitiesDoc, 'p1')!;
    const personNames = Array.from(person.getElementsByTagName('persName'));
    expect(
      personNames.map((el) => [el.textContent, el.getAttribute('xml:lang'), el.getAttribute('type')]),
    ).toEqual([
      ['張衡', 'zh-Hant', 'primary'],
      ['Zhang Heng', 'zh-Latn', null],
    ]);

    // place without pack pinyin: autogenerated from the primary name
    const place = entityByAuthority(entitiesDoc, 'pl9')!;
    const placeNames = Array.from(place.getElementsByTagName('placeName'));
    expect(placeNames.map((el) => el.textContent)).toEqual(['洛陽', 'Luo Yang']);
  });

  it('keeps legacy attribute-free names without a project language', async () => {
    const doc = parse(TEI);
    const entitiesDoc = parseEntities(createEntitiesScaffold());
    const candidates = [cand({ authorityId: 'p1', primaryName: '張衡', searchStrings: ['張衡'] })];
    const { unique } = bucketSeeds(seedSuggestions(doc, candidates, 'ignore'));

    await autoLinkUnique(doc, entitiesDoc, unique, { policy: 'ignore' });
    const person = entityByAuthority(entitiesDoc, 'p1')!;
    const name = person.getElementsByTagName('persName')[0]!;
    expect(name.getAttribute('xml:lang')).toBeNull();
    expect(name.getAttribute('type')).toBeNull();
    expect(person.getElementsByTagName('persName')).toHaveLength(1);
  });

  it('reuses one entity for repeated occurrences of the same authority id', async () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>李白見李白。</p></TEI>`,
    );
    const entitiesDoc = parseEntities(createEntitiesScaffold());
    const candidates = [cand({ authorityId: 'p7', primaryName: '李白', searchStrings: ['李白'] })];
    const { unique } = bucketSeeds(seedSuggestions(doc, candidates, 'ignore'));
    expect(unique).toHaveLength(2); // two occurrences

    const result = await autoLinkUnique(doc, entitiesDoc, unique, { policy: 'ignore' });
    expect(result.linked).toBe(2);
    expect(result.entitiesCreated).toBe(1); // but only one entity
    expect(entitiesDoc.getElementsByTagName('person')).toHaveLength(1);
  });
});

describe('real authority + corpus (all_together.csv → sizhu_shang.xml)', () => {
  const csvPath = path.resolve(__dirname, '../../../../databases/all_together.csv');
  const xmlPath = path.resolve(__dirname, '../../../../test_project/sizhu_shang.xml');
  const maybe = fs.existsSync(csvPath) && fs.existsSync(xmlPath) ? it : it.skip;

  maybe('seeds, buckets, and auto-links unique person/place hits', async () => {
    const candidates = candidatesFromCsv(fs.readFileSync(csvPath, 'utf-8'), 'DPM').filter(
      (c) => (c.kind === 'person' || c.kind === 'place') && c.primaryName.length > 1,
    );
    expect(candidates.length).toBeGreaterThan(1000);

    const doc = parse(fs.readFileSync(xmlPath, 'utf-8'));
    const matches = seedSuggestions(doc, candidates, 'ignore');
    const { unique, ambiguous } = bucketSeeds(matches);
    expect(matches.length).toBeGreaterThan(0);

    const entitiesDoc = parseEntities(createEntitiesScaffold());
    const result = await autoLinkUnique(doc, entitiesDoc, unique, { policy: 'ignore' });
    expect(result.linked).toBe(unique.length);
    expect(result.entitiesCreated).toBeGreaterThan(0);

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '── authority seed (bombard) ────────────────────────────',
        `  candidates (person+place): ${candidates.length}`,
        `  corpus matches:            ${matches.length}`,
        `  unique (auto-linked):      ${unique.length}`,
        `  ambiguous (→ 4b panel):    ${ambiguous.length}`,
        `  entities minted:           ${result.entitiesCreated}`,
        '────────────────────────────────────────────────────────',
      ].join('\n'),
    );
  });
});
