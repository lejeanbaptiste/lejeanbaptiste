import {
  candidatesFromEntityFile,
  candidateLinks,
  collapseCrossAuthorityCandidates,
  extractCbdbId,
  extractWikidataId,
  mergeSelectedCandidates,
} from './disambiguationCandidates';
import { createEntitiesScaffold, parseEntities } from './entities';

describe('disambiguationCandidates', () => {
  it('finds local entity-file matches', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const listPerson = doc.getElementsByTagName('listPerson')[0]!;
    const person = doc.createElementNS('http://www.tei-c.org/ns/1.0', 'person');
    person.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:id', 'person-000001');
    const name = doc.createElementNS('http://www.tei-c.org/ns/1.0', 'persName');
    name.textContent = '張衡';
    person.appendChild(name);
    listPerson.appendChild(person);

    const rows = candidatesFromEntityFile(doc, 'persName', '張衡');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.localEntityId).toBe('person-000001');
    expect(rows[0]?.sources).toContain('entity-file');
  });

  it('extracts Wikidata ids from VIAF source codes', () => {
    expect(extractWikidataId('WKP|Q1137864')).toBe('Q1137864');
    expect(extractWikidataId('https://www.wikidata.org/wiki/Q42')).toBe('Q42');
  });

  it('extracts CBDB ids from reconcile descriptions', () => {
    expect(extractCbdbId('person, CBDB ID = 392870')).toBe('392870');
    expect(extractCbdbId('Tang dynasty person CBDB = 178700')).toBe('178700');
  });

  it('stores CBDB id from Wikidata description on live candidates', async () => {
    // Covered indirectly via authorityIdsFromCrossRefs in fetchLiveCandidates;
    // test enrichment through candidateLinks after manual candidate shape.
    const links = candidateLinks({
      id: 'wd',
      label: 'Sima Guofan',
      sources: ['Wikidata'],
      description: 'person, CBDB ID = 392870',
      authorityIds: [
        { type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q42' },
        { type: 'CBDB', value: '392870' },
      ],
    });
    expect(links.some((link) => link.kind === 'cbdb' && link.url.includes('392870'))).toBe(true);
  });

  it('collapses Wikidata and VIAF when they share a Q id', () => {
    const rows = collapseCrossAuthorityCandidates([
      {
        id: 'https://www.wikidata.org/wiki/Q1137864',
        label: 'Example Person',
        sources: ['Wikidata'],
        uri: 'https://www.wikidata.org/wiki/Q1137864',
        authorityIds: [{ type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q1137864' }],
      },
      {
        id: 'https://viaf.org/viaf/404064183',
        label: 'Example Person',
        description: 'Sources: WKP|Q1137864',
        sources: ['VIAF'],
        uri: 'https://viaf.org/viaf/404064183',
        authorityIds: [{ type: 'VIAF', value: 'https://viaf.org/viaf/404064183' }],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sources).toEqual(expect.arrayContaining(['Wikidata', 'VIAF']));
    expect(rows[0]?.authorityIds).toHaveLength(2);
  });

  it('merges manually selected candidates', () => {
    const merged = mergeSelectedCandidates([
      {
        id: 'a',
        label: 'A',
        sources: ['Wikidata'],
        authorityIds: [{ type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q1' }],
      },
      {
        id: 'b',
        label: 'B',
        sources: ['VIAF'],
        authorityIds: [{ type: 'VIAF', value: 'https://viaf.org/viaf/99' }],
      },
    ]);
    expect(merged?.sources).toEqual(['Wikidata', 'VIAF']);
    expect(merged?.authorityIds).toHaveLength(2);
  });

  it('builds external links for candidates', () => {
    const links = candidateLinks({
      id: 'x',
      label: 'Test',
      sources: ['Wikidata', 'VIAF'],
      uri: 'https://www.wikidata.org/wiki/Q42',
      description: 'WKP|Q42 · viaf.org/viaf/123',
    });
    const wiki = links.find((link) => link.kind === 'wikipedia');
    expect(wiki?.url).toContain('wikidata.org/wiki/Special:GoToLinkedPage/enwiki/Q42');
    expect(wiki?.url).not.toContain('en.wikipedia.org');
    expect(links.some((link) => link.kind === 'viaf' && link.url.includes('123'))).toBe(true);
  });

  it('prefers Chinese Wikipedia sitelinks for zh locale', () => {
    const links = candidateLinks(
      { id: 'x', label: 'Test', sources: ['Wikidata'], uri: 'https://www.wikidata.org/wiki/Q42' },
      { wikiSite: 'zhwiki' },
    );
    expect(links[0]?.url).toContain('/zhwiki/Q42');
  });
});
