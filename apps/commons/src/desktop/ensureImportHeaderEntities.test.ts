import { authorityIdsFromTeiRef, normalizeImportedWorkTitle } from './ensureImportHeaderEntities';

describe('authorityIdsFromTeiRef', () => {
  it('parses Wikidata URIs', () => {
    expect(authorityIdsFromTeiRef('https://www.wikidata.org/entity/Q535')).toEqual([
      { type: 'Wikidata', value: 'Q535' },
    ]);
  });

  it('parses Norbert and DILA tokens', () => {
    expect(authorityIdsFromTeiRef('NORBERT:person-1421')).toEqual([
      { type: 'NORBERT', value: 'person-1421' },
    ]);
    expect(authorityIdsFromTeiRef('DILA:A001492')).toEqual([{ type: 'DILA', value: 'A001492' }]);
  });

  it('parses BDRC purls', () => {
    expect(authorityIdsFromTeiRef('http://purl.bdrc.io/resource/P1583')).toEqual([
      { type: 'BDRC', value: 'P1583' },
    ]);
  });
});

describe('normalizeImportedWorkTitle', () => {
  it('removes fascicle suffixes', () => {
    expect(normalizeImportedWorkTitle('Kangyur vol. ka — བམ་པོ་ 3')).toBe('Kangyur vol. ka');
    expect(normalizeImportedWorkTitle('Some sūtra — juan 2')).toBe('Some sūtra');
  });
});
