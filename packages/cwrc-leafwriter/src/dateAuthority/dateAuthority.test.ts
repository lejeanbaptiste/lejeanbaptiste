import {
  buildSearchText,
  enrichDateAuthorityIndex,
  filterEras,
  matchesSearchText,
} from './search';
import {
  eastAsianValuesToAttributes,
  hasEastAsianCalendarContext,
  normalizeYearInput,
  readEastAsianDateValues,
} from './values';

describe('dateAuthority values', () => {
  it('normalizes 元年 to year 1', () => {
    expect(normalizeYearInput('元年')).toBe('1');
    expect(eastAsianValuesToAttributes({ dynId: '', rulerId: '', eraId: '', year: '元年', month: '', day: '', sexYear: '', gz: '', nmdGz: '' })).toEqual({
      year: '1',
    });
  });

  it('normalizes Chinese numerals and gz names on write', () => {
    expect(
      eastAsianValuesToAttributes({
        dynId: '',
        rulerId: '',
        eraId: '',
        year: '',
        month: '十八',
        day: '',
        sexYear: '',
        gz: '甲子',
        nmdGz: '',
      }),
    ).toEqual({ month: '18', gz: '1' });
  });

  it('reads sanmiao attrs into picker state', () => {
    expect(
      readEastAsianDateValues({
        dyn_id: '119',
        ruler_id: '15305',
        era_id: '505',
        year: '1',
        gz: '42',
        nmd_gz: '60',
      }),
    ).toEqual({
      dynId: '119',
      rulerId: '15305',
      eraId: '505',
      year: '元年',
      month: '',
      day: '',
      sexYear: '',
      gz: '42',
      nmdGz: '60',
    });
  });

  it('requires at least one calendar anchor', () => {
    expect(
      hasEastAsianCalendarContext({
        dynId: '',
        rulerId: '',
        eraId: '',
        year: '',
        month: '',
        day: '',
        sexYear: '',
        gz: '',
        nmdGz: '',
      }),
    ).toBe(false);
    expect(
      hasEastAsianCalendarContext({
        dynId: '119',
        rulerId: '',
        eraId: '',
        year: '',
        month: '',
        day: '',
        sexYear: '',
        gz: '',
        nmdGz: '',
      }),
    ).toBe(true);
  });
});

describe('dateAuthority search', () => {
  it('matches pinyin prefix queries', () => {
    const blob = buildSearchText(['正光']);
    expect(matchesSearchText(blob, 'zhengg')).toBe(true);
    expect(matchesSearchText(blob, '正')).toBe(true);
  });

  it('filters eras by dynasty and ruler', () => {
    const index = enrichDateAuthorityIndex({
      dynasties: [{ dynId: 119, label: '宋' }],
      rulers: [
        { rulerId: 15305, dynId: 119, label: '太祖', dynLabel: '宋' },
        { rulerId: 15306, dynId: 119, label: '太宗', dynLabel: '宋' },
      ],
      eras: [
        {
          eraId: 505,
          dynId: 119,
          rulerId: 15305,
          label: '建隆',
          dynLabel: '宋',
          rulerLabel: '太祖',
        },
        {
          eraId: 600,
          dynId: 119,
          rulerId: 15306,
          label: '太平興國',
          dynLabel: '宋',
          rulerLabel: '太宗',
        },
      ],
    });

    const filtered = filterEras(index.eras, '119', '15305', '');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.label).toBe('建隆');
  });
});
