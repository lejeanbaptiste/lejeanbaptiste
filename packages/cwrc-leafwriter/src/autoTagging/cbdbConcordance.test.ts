import {
  CBDB_CONCORDANCE_SOURCE,
  parseCbdbConcordanceAssociations,
} from './cbdbConcordance';

describe('parseCbdbConcordanceAssociations', () => {
  it('defaults source to CBDB when the pack row omits source', () => {
    const line = JSON.stringify({
      canonicalId: '31',
      mergedFromId: '98561',
      notes: 'same person',
    });
    expect(parseCbdbConcordanceAssociations(line)).toEqual([
      {
        source: CBDB_CONCORDANCE_SOURCE,
        canonicalId: '31',
        mergedFromId: '98561',
        notes: 'same person',
      },
    ]);
  });

  it('ignores bibliographic source ids and still uses CBDB', () => {
    const line = JSON.stringify({
      canonicalId: '141',
      mergedFromId: '96120',
      source: '32053',
      notes: 'match',
    });
    expect(parseCbdbConcordanceAssociations([line])).toEqual([
      {
        source: 'CBDB',
        canonicalId: '141',
        mergedFromId: '96120',
        notes: 'match',
      },
    ]);
  });

  it('skips malformed lines and rows missing ids', () => {
    const content = [
      'not-json',
      JSON.stringify({ canonicalId: '1' }),
      JSON.stringify({ canonicalId: '55', mergedFromId: '468758' }),
    ].join('\n');
    expect(parseCbdbConcordanceAssociations(content)).toEqual([
      {
        source: 'CBDB',
        canonicalId: '55',
        mergedFromId: '468758',
      },
    ]);
  });
});
