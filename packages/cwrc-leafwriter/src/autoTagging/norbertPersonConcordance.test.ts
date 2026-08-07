import {
  clearNorbertPersonConcordanceCacheForTests,
  expandIdnosWithNorbertConcordance,
  filterAttachablePersonAuthorities,
  idnosFromNorbertConcordance,
  parseNorbertPersonConcordance,
  attachPersonCrosswalkAuthorities,
} from './norbertPersonConcordance';

describe('norbertPersonConcordance', () => {
  afterEach(() => {
    clearNorbertPersonConcordanceCacheForTests();
  });

  const sample = [
    JSON.stringify({
      source: 'Norbert-concordance',
      authorityId: 'Norbert:5:cbdb:555431',
      kind: 'person',
      primaryName: '晁崇',
      metadata: {
        norbert: { authorityId: '5', primaryName: '晁崇' },
        matched: { source: 'cbdb', authorityId: '555431', primaryName: '晁崇' },
      },
    }),
    JSON.stringify({
      source: 'Norbert-concordance',
      authorityId: 'Norbert:41:wikidata:Q123',
      kind: 'person',
      primaryName: '高閭',
      metadata: {
        norbert: { authorityId: '41', primaryName: '高閭' },
        matched: { source: 'wikidata', authorityId: '123', primaryName: '高閭' },
      },
    }),
  ];

  it('parses bidirectional Norbert ↔ CBDB / Wikidata links', () => {
    const index = parseNorbertPersonConcordance(sample);
    expect(idnosFromNorbertConcordance(index, 'NORBERT', '5')).toEqual([
      { type: 'CBDB', value: '555431' },
    ]);
    expect(idnosFromNorbertConcordance(index, 'NORBERT', 'person-5')).toEqual([
      { type: 'CBDB', value: '555431' },
    ]);
    expect(idnosFromNorbertConcordance(index, 'CBDB', '555431')).toEqual([
      { type: 'NORBERT', value: 'person-5' },
    ]);
    expect(idnosFromNorbertConcordance(index, 'NORBERT', '41')).toEqual([
      { type: 'Wikidata', value: 'Q123' },
    ]);
    expect(idnosFromNorbertConcordance(index, 'Wikidata', 'Q123')).toEqual([
      { type: 'NORBERT', value: 'person-41' },
    ]);
  });

  it('expands an idno set through the concordance', () => {
    const index = parseNorbertPersonConcordance(sample);
    expect(
      expandIdnosWithNorbertConcordance([{ type: 'NORBERT', value: 'person-5' }], index),
    ).toEqual(
      expect.arrayContaining([
        { type: 'NORBERT', value: 'person-5' },
        { type: 'CBDB', value: '555431' },
      ]),
    );
  });

  it('filters attachable authorities around conflicts and claims', async () => {
    const store = {
      sqliteFindByAuthority: jest.fn(async (_kind, type, value) => {
        if (type === 'CBDB' && value === 'taken') return 'other-person';
        return null;
      }),
    };
    const attachable = await filterAttachablePersonAuthorities(
      store as never,
      'me',
      [{ type: 'NORBERT', value: 'person-5' }],
      [
        { type: 'NORBERT', value: 'person-5' }, // already present
        { type: 'CBDB', value: '555431' }, // free
        { type: 'CBDB', value: 'taken' }, // claimed elsewhere
        { type: 'DILA', value: 'A1' },
        { type: 'DILA', value: 'A2' }, // same-type conflict with A1 once A1 reserved
      ],
    );
    expect(attachable).toEqual([
      { type: 'CBDB', value: '555431' },
      { type: 'DILA', value: 'A1' },
    ]);
  });

  it('merges same-name duplicates when the bridge target is already claimed', async () => {
    const index = parseNorbertPersonConcordance(sample);
    const attached: string[] = [];
    const store = {
      sqliteFindByAuthority: jest.fn(async (_kind, type, value) => {
        if (type === 'CBDB' && value === '555431') return 'keep-id';
        return null;
      }),
      sqliteEntitySummary: jest.fn(async (id) => ({
        names: [{ text: '晁崇', isPrimary: true }],
        id,
      })),
      sqliteAttachAuthority: jest.fn(async (entityId, type, value) => {
        attached.push(`${entityId}:${type}:${value}`);
        return true;
      }),
      sqliteMerge: jest.fn(async (keepId, dropIds) => ({
        keepId,
        remap: Object.fromEntries(dropIds.map((id) => [id, keepId])),
        centralConflicts: [],
      })),
    };
    const result = await attachPersonCrosswalkAuthorities(
      store as never,
      'drop-id',
      [{ type: 'NORBERT', value: 'person-5' }],
      { concordance: index, primaryName: '晁崇' },
    );
    expect(result.mergedInto).toEqual(['keep-id']);
    expect(store.sqliteMerge).toHaveBeenCalledWith('keep-id', ['drop-id']);
    expect(attached).toContain('keep-id:NORBERT:person-5');
  });

  it('records a conflict when names differ and the bridge target is claimed', async () => {
    const index = parseNorbertPersonConcordance(sample);
    const store = {
      sqliteFindByAuthority: jest.fn(async (_kind, type, value) => {
        if (type === 'CBDB' && value === '555431') return 'other-id';
        return null;
      }),
      sqliteEntitySummary: jest.fn(async (id) => ({
        names: [{ text: id === 'other-id' ? '別人' : '晁崇', isPrimary: true }],
        id,
      })),
      sqliteAttachAuthority: jest.fn(async () => true),
      sqliteMerge: jest.fn(),
    };
    const result = await attachPersonCrosswalkAuthorities(
      store as never,
      'me',
      [{ type: 'NORBERT', value: 'person-5' }],
      { concordance: index, primaryName: '晁崇' },
    );
    expect(result.attached).toBe(0);
    expect(result.mergedInto).toEqual([]);
    expect(result.conflicts).toEqual([
      { authority: 'CBDB', value: '555431', entityIds: ['me', 'other-id'] },
    ]);
    expect(store.sqliteMerge).not.toHaveBeenCalled();
  });
});
