import fs from 'fs';
import path from 'path';
import type { AuthorityCandidate } from './authority';
import { candidatesFromCsv } from './authority';
import { createEntitiesScaffold, findEntity, parseEntities } from './entities';
import { normalizeDomText } from './normalize';
import { autoLinkUnique, bucketSeeds, seedSuggestions } from './seed';

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
});

describe('autoLinkUnique', () => {
  it('mints entities, tags mentions, and stamps key + resp', async () => {
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

    const xml = new XMLSerializer().serializeToString(doc);
    expect(xml).toMatch(/<placeName key="place-000001" resp="#ljb-autotag">洛陽<\/placeName>/);
    // the minted entity carries the authority idno
    const person = findEntity(entitiesDoc, 'person-000001')!;
    expect(person.getElementsByTagName('idno')[0]?.textContent).toBe('p1');
    expect(person.getAttribute('resp')).toBe('#ljb-autotag');
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
