import fs from 'fs';
import path from 'path';
import type { AuthorityCandidate } from './authority';
import { candidatesFromCsv } from './authority';
import { createEntitiesScaffold, parseEntities, readOfficeRelations } from './entities';
import { normalizeDomText } from './normalize';
import {
  autoLinkUnique,
  bucketSeeds,
  compoundWrapperSuggestions,
  seedSuggestions,
  suggestionsFromSeedMatches,
} from './seed';

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

  it('turns a wrapper candidate into nested personWrapper content', () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>鄱陽王範</p></body></text></TEI>',
    );
    const candidate = cand({
      authorityId: 'noble-title:19',
      searchStrings: ['鄱陽王範'],
      metadata: {
        wrapper: {
          personId: '7',
          titleRowId: '19',
          components: { fief: '鄱陽', roleName: '王', persName: '範' },
        },
      },
    });
    const [suggestion] = suggestionsFromSeedMatches(seedSuggestions(doc, [candidate], 'ignore'));
    expect(suggestion?.tag).toBe('name');
    expect(suggestion?.attributes).toEqual({ type: 'personWrapper', cert: 'unknown' });
    expect(suggestion?.innerXml).toBe(
      '<nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle><persName>範</persName>',
    );
  });

  it('never fabricates a posthumous name the document never contained — matched the bare (fief+rank) form', () => {
    // Reproduces a real bug: one candidate's full "fief+posthumousName+roleName"
    // and bare "fief+roleName" search strings share one metadata.nobleTitle
    // object. Using it unconditionally spliced a full posthumous name into a
    // span the document only ever matched in its bare form.
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>明帝遣使</p></body></text></TEI>',
    );
    const candidate = cand({
      authorityId: 'noble-title:emperor-ming',
      primaryName: '明欽天履道英毅帝',
      searchStrings: ['明欽天履道英毅帝', '明帝'],
      metadata: {
        isNobleTitle: true,
        teiTag: 'nobleTitle',
        nobleTitle: { fief: '明', posthumousName: '欽天履道英毅', roleName: '帝' },
      },
    });
    const [suggestion] = suggestionsFromSeedMatches(seedSuggestions(doc, [candidate], 'ignore'));
    expect(suggestion?.anchor.surface).toBe('明帝');
    expect(suggestion?.innerXml).toBe('<placeName>明</placeName><roleName>帝</roleName>');
    expect(suggestion?.innerXml).not.toContain('欽天履道英毅');
  });

  it('uses the full posthumous name only when the full form is what actually matched', () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>明欽天履道英毅帝遣使</p></body></text></TEI>',
    );
    const candidate = cand({
      authorityId: 'noble-title:emperor-ming',
      primaryName: '明欽天履道英毅帝',
      searchStrings: ['明欽天履道英毅帝', '明帝'],
      metadata: {
        isNobleTitle: true,
        teiTag: 'nobleTitle',
        nobleTitle: { fief: '明', posthumousName: '欽天履道英毅', roleName: '帝' },
      },
    });
    const [suggestion] = suggestionsFromSeedMatches(seedSuggestions(doc, [candidate], 'ignore'));
    expect(suggestion?.anchor.surface).toBe('明欽天履道英毅帝');
    expect(suggestion?.innerXml).toBe(
      '<placeName>明</placeName><persName type="posthumous">欽天履道英毅</persName><roleName>帝</roleName>',
    );
  });

  it('finds a wrapper after its component elements already exist', () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><roleName>合州刺史</roleName><nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle><persName>範</persName></p></body></text></TEI>',
    );
    const candidate = cand({
      authorityId: 'noble-title:20',
      searchStrings: ['合州刺史鄱陽王範'],
      metadata: {
        wrapper: {
          personId: '8',
          titleRowId: '20',
          components: { roleName: '合州刺史', fief: '鄱陽', persName: '範' },
        },
      },
    });
    const [match] = compoundWrapperSuggestions(doc, [candidate], 'ignore');
    expect(match?.suggestion.action).toBe('add-compound');
    expect(match?.suggestion.anchor.endXpath).toBeDefined();
    expect(match?.candidates[0]?.metadata?.wrapper?.personId).toBe('8');
  });

  it('ignores a two-character rank+name form colliding with untagged running text', () => {
    // Real bug: a Norbert wrapper row for a 侯 linked to a one-character name
    // 道 expands to the search string 侯道, which then matched the unrelated
    // run 安[侯]|[道]人 (侯 tail of an already-tagged 安侯, 道 opening 道人).
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>方有安<roleName>侯</roleName>道人？</p></body></text></TEI>',
    );
    const candidate = cand({
      authorityId: 'noble-title:hou-dao',
      searchStrings: ['侯道'],
      metadata: {
        wrapper: {
          personId: '9',
          titleRowId: '99',
          components: { roleName: '侯', persName: '道' },
        },
      },
    });
    expect(compoundWrapperSuggestions(doc, [candidate], 'ignore')).toHaveLength(0);
  });

  it('ignores a wrapper string that straddles a tagged component and bare body text', () => {
    // The span must be represented by adjacent *tagged* components; 範 here is
    // loose running text, so the concatenation has merely collided with it.
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle>範居此</p></body></text></TEI>',
    );
    const candidate = cand({
      authorityId: 'noble-title:21',
      searchStrings: ['鄱陽王範'],
      metadata: {
        wrapper: {
          personId: '8',
          titleRowId: '21',
          components: { fief: '鄱陽', roleName: '王', persName: '範' },
        },
      },
    });
    expect(compoundWrapperSuggestions(doc, [candidate], 'ignore')).toHaveLength(0);
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

  it('links Norbert noble-title wrappers to the Norbert person id', async () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>漢昭烈帝劉備</p></body></text></TEI>',
    );
    const entitiesDoc = parseEntities(createEntitiesScaffold());
    const candidate = cand({
      source: 'Norbert',
      authorityId: 'noble-title:1112',
      primaryName: '漢昭烈帝劉備',
      searchStrings: ['漢昭烈帝劉備'],
      metadata: {
        wrapper: {
          personId: '3710',
          titleRowId: '1112',
          components: {
            nationality: '漢',
            fief: '漢',
            roleName: '帝',
            posthumousName: '昭烈',
            persName: '劉備',
          },
        },
        crosswalk: { norbert: '3710' },
      },
    });
    const { unique } = bucketSeeds(seedSuggestions(doc, [candidate], 'ignore'));
    await autoLinkUnique(doc, entitiesDoc, unique, { policy: 'ignore' });
    // Norbert person idnos are namespaced (`person-3710`); wrapper row id stays
    // as `noble-title:…` on the same entity.
    const person = entityByAuthority(entitiesDoc, 'person-3710');
    expect(person).not.toBeNull();
    expect(entityByAuthority(entitiesDoc, 'noble-title:1112')).toBe(person);
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
      personNames.map((el) => [
        el.textContent,
        el.getAttribute('xml:lang'),
        el.getAttribute('type'),
      ]),
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
    const doc = parse(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>李白見李白。</p></TEI>`);
    const entitiesDoc = parseEntities(createEntitiesScaffold());
    const candidates = [cand({ authorityId: 'p7', primaryName: '李白', searchStrings: ['李白'] })];
    const { unique } = bucketSeeds(seedSuggestions(doc, candidates, 'ignore'));
    expect(unique).toHaveLength(2); // two occurrences

    const result = await autoLinkUnique(doc, entitiesDoc, unique, { policy: 'ignore' });
    expect(result.linked).toBe(2);
    expect(result.entitiesCreated).toBe(1); // but only one entity
    expect(entitiesDoc.getElementsByTagName('person')).toHaveLength(1);
  });

  it('imports an explicit Norbert office parent and hierarchy relation', async () => {
    const doc = parse('<TEI><text><p>吏部</p></text></TEI>');
    const entitiesDoc = parseEntities(createEntitiesScaffold());
    const child = cand({
      source: 'Norbert',
      authorityId: '2',
      kind: 'office',
      primaryName: '吏部',
      searchStrings: ['吏部'],
      metadata: {
        parentOffice: {
          source: 'Norbert',
          authorityId: '1',
          entityId: 'norbert:office:1',
          name: '尚書省',
        },
      },
    });
    const { unique } = bucketSeeds(seedSuggestions(doc, [child], 'ignore'));
    const result = await autoLinkUnique(doc, entitiesDoc, unique, { policy: 'ignore' });
    expect(result.entitiesCreated).toBe(2);
    expect(result.relationsCreated).toBe(1);
    const offices = Array.from(entitiesDoc.getElementsByTagName('org')).filter(
      (item) => item.getAttribute('type') === 'office',
    );
    expect(offices.map((item) => item.getElementsByTagName('orgName')[0]?.textContent)).toEqual(
      expect.arrayContaining(['尚書省', '吏部']),
    );
    expect(readOfficeRelations(entitiesDoc)).toHaveLength(1);
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
