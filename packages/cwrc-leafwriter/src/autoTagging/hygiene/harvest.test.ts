import {
  collectHarvestedWrappers,
  extractPersonWrapperFacts,
  filterNewHarvestAssertions,
  findingsFromHarvest,
  summarizeHarvestAssertions,
} from './harvest';
import type { EntitySummary } from '../entityOps';

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

const basePerson = (overrides: Partial<EntitySummary> & { id: string }): EntitySummary => ({
  id: overrides.id,
  kind: 'person',
  names: overrides.names ?? ['範'],
  nameEntries: overrides.nameEntries ?? [{ text: '範', lang: 'zh-Hant', type: 'primary' }],
  romanized: null,
  description: null,
  authorities: [],
  familyName: null,
  givenName: null,
  startYear: null,
  endYear: null,
  workDate: null,
  nationalities: overrides.nationalities ?? [],
  placesOfOrigin: overrides.placesOfOrigin ?? [],
  authors: [],
  nobleTitles: overrides.nobleTitles ?? [],
  roles: overrides.roles ?? [],
  origins: [],
  rejectedCount: 0,
  rejectedAssertions: [],
  rejectedConcordances: [],
  assertions: [],
});

describe('extractPersonWrapperFacts', () => {
  it('harvests noble title, dynasty, origin, and roleName from a person wrapper', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><name type="personWrapper" key="person-1">
        <nationality>漢</nationality>
        <placeOfOrigin>洛陽</placeOfOrigin>
        <officeName>太史令</officeName>
        <nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle>
        <persName key="person-1">範</persName>
      </name></text></TEI>`,
    );
    const wrapper = doc.getElementsByTagName('name')[0]!;
    const assertions = extractPersonWrapperFacts(wrapper);
    expect(assertions.map((a) => [a.element, a.value])).toEqual(
      expect.arrayContaining([
        ['nationality', '漢'],
        ['placeName', '洛陽'],
        ['state', '太史令'],
        ['nobleTitle', '鄱陽王'],
      ]),
    );
    const title = assertions.find((a) => a.element === 'nobleTitle');
    expect(title?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: 'placeName', value: '鄱陽' }),
        expect.objectContaining({ element: 'roleName', value: '王' }),
      ]),
    );
  });

  it('reads bare roleName under the wrapper as an office', () => {
    const doc = parse(
      `<TEI><name type="personWrapper" key="p"><roleName>丞相</roleName><persName key="p">甲</persName></name></TEI>`,
    );
    expect(extractPersonWrapperFacts(doc.getElementsByTagName('name')[0]!)).toEqual([
      { element: 'state', value: '丞相', ref: undefined },
    ]);
  });
});

describe('collectHarvestedWrappers / filter / findings', () => {
  it('skips wrappers without a person key', () => {
    const doc = parse(
      `<TEI><name type="personWrapper"><nationality>漢</nationality><persName>無名</persName></name></TEI>`,
    );
    expect(collectHarvestedWrappers(doc, 'ch1.xml')).toHaveLength(0);
  });

  it('filters out facts already on the entity', () => {
    const entity = basePerson({
      id: 'person-1',
      nationalities: ['漢'],
      placesOfOrigin: ['洛陽'],
      roles: ['太史令'],
    });
    const novel = filterNewHarvestAssertions(entity, [
      { element: 'nationality', value: '漢' },
      { element: 'placeName', value: '長安' },
      { element: 'state', value: '太史令' },
      { element: 'nobleTitle', value: '鄱陽王' },
    ]);
    expect(novel.map((a) => a.value)).toEqual(['長安', '鄱陽王']);
  });

  it('builds ingest findings only for novel facts', () => {
    const doc = parse(
      `<TEI><name type="personWrapper" key="person-1">
        <nationality>漢</nationality>
        <placeOfOrigin>洛陽</placeOfOrigin>
        <persName key="person-1">範</persName>
      </name></TEI>`,
    );
    const wrappers = collectHarvestedWrappers(doc, 'chapter-1.xml');
    const entity = basePerson({ id: 'person-1', nationalities: ['漢'] });
    const findings = findingsFromHarvest(wrappers, new Map([['person-1', entity]]));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('harvestWrapper');
    expect(findings[0]?.proposal).toMatchObject({
      action: 'ingestHarvest',
      documentKey: 'chapter-1.xml',
    });
    if (findings[0]?.proposal.action === 'ingestHarvest') {
      expect(findings[0].proposal.assertions).toEqual([
        expect.objectContaining({ element: 'placeName', value: '洛陽' }),
      ]);
    }
    expect(summarizeHarvestAssertions([{ element: 'placeName', value: '洛陽' }])).toBe(
      'origin 洛陽',
    );
  });

  it('does not associate harvested facts with non-person or unresolved entities', () => {
    const doc = parse(
      `<TEI><text><name type="personWrapper" key="place-1">
        <nationality>漢</nationality><placeOfOrigin>洛陽</placeOfOrigin>
      </name><name type="personWrapper" key="missing-1">
        <nationality>魏</nationality>
      </name></text></TEI>`,
    );
    const wrappers = collectHarvestedWrappers(doc, 'chapter-1.xml');
    const place = basePerson({ id: 'place-1' });
    const nonPerson = { ...place, kind: 'place' as const };

    expect(findingsFromHarvest(wrappers, new Map([['place-1', nonPerson]]))).toEqual([]);
    expect(findingsFromHarvest(wrappers, new Map())).toEqual([]);
  });
});
