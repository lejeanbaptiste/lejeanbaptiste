import {
  authorityRowsFromCsv,
  candidatesFromCsv,
  candidatesFromRows,
  type AuthorityRow,
} from './authority';

describe('candidatesFromRows', () => {
  it('groups rows by (kind, id), collecting search strings; ntName folds into person', () => {
    const rows: AuthorityRow[] = [
      { id: '42', string: '張衡', tag: 'persName' },
      { id: '42', string: '平子', tag: 'ntName' }, // variant → same person
      { id: '7', string: '洛陽', tag: 'placeName', subtype: '郡' },
    ];
    const candidates = candidatesFromRows(rows, 'DPM');

    const zhang = candidates.find((c) => c.authorityId === '42')!;
    expect(zhang.kind).toBe('person');
    expect(zhang.primaryName).toBe('張衡');
    expect(zhang.searchStrings).toEqual(['張衡', '平子']);

    const luoyang = candidates.find((c) => c.authorityId === '7')!;
    expect(luoyang.kind).toBe('place');
    expect(luoyang.metadata?.subtype).toBe('郡');
  });

  it('maps officeName rows to office kind', () => {
    const rows: AuthorityRow[] = [
      { id: '1', string: '丞', tag: 'officeName' },
      { id: '2', string: '張衡', tag: 'persName' },
    ];
    const candidates = candidatesFromRows(rows, 'x');
    expect(candidates.map((c) => c.authorityId).sort()).toEqual(['1', '2']);
    expect(candidates.find((c) => c.authorityId === '1')!.kind).toBe('office');
  });
});

describe('authorityRowsFromCsv', () => {
  it('reads DPM-style columns, cleans float ids, maps cat→subtype', () => {
    const csv = [
      'person_id,string,abr,tag,office_id,cat,follows_place,follows_office,follows_person,is_qualifier,start_year,end_year',
      '3854.0,漢顯宗,,ntName,,,,,,,,',
      ',丞,,officeName,323.0,,b\'\\x01\',b\'\\x01\',,,,',
      '80160.0,張衡,,persName,,,,,,,,',
    ].join('\n');

    const rows = authorityRowsFromCsv(csv);
    // office row takes its id from office_id when person_id is blank
    expect(rows).toEqual([
      { id: '3854', string: '漢顯宗', tag: 'ntName' },
      { id: '323', string: '丞', tag: 'officeName' },
      { id: '80160', string: '張衡', tag: 'persName' },
    ]);
  });

  it('honors an overridden column map', () => {
    const csv = 'pid,name,type\n9,李白,persName';
    const rows = authorityRowsFromCsv(csv, { id: ['pid'], string: 'name', tag: 'type' });
    expect(rows).toEqual([{ id: '9', string: '李白', tag: 'persName' }]);
  });

  it('candidatesFromCsv composes parse + group', () => {
    const csv = 'person_id,string,tag\n1,張衡,persName\n1,平子,ntName';
    const candidates = candidatesFromCsv(csv, 'DPM');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.searchStrings).toEqual(['張衡', '平子']);
  });
});
