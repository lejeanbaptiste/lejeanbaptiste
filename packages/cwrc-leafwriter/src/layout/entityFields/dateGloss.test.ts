/**
 * @jest-environment jsdom
 */
import { sexagenaryToPinyin } from '../../dateAuthority/chineseNumerals';
import {
  dateGlossInputFromParts,
  formatDateGlossPlain,
  formatWesternWhen,
} from './dateGloss';

describe('sexagenaryToPinyin', () => {
  test('maps names and indices', () => {
    expect(sexagenaryToPinyin('壬戌')).toBe('renxu');
    expect(sexagenaryToPinyin('甲寅')).toBe('jiayin');
    expect(sexagenaryToPinyin(1)).toBe('jiazi');
  });
});

describe('formatWesternWhen', () => {
  test('formats ISO dates', () => {
    expect(formatWesternWhen('0481-02-15', 'en')).toBe('15 February 481');
    expect(formatWesternWhen('0481-02-15', 'fr')).toBe('15 février 481');
  });
});

describe('formatDateGlossPlain', () => {
  test('full day-level Southern Qi example', () => {
    const gloss = formatDateGlossPlain(
      {
        dyn: '南齊',
        ruler: '太祖',
        era: '建元',
        year: '三年',
        month: '正月',
        gz: '壬戌',
        lp: '朔',
        when: '0481-02-15',
      },
      'en',
    );
    expect(gloss).toBe(
      'On Southern Qi, Emperor Taizu, Jianyuan era, year 3, month I, day renxu, new moon (15 February 481)',
    );
  });

  test('year-only with emperor and era', () => {
    expect(
      formatDateGlossPlain({ ruler: '太祖', era: '建元', year: '三年' }, 'en'),
    ).toBe('In Emperor Taizu, Jianyuan era, year 3');
  });

  test('year and month', () => {
    expect(
      formatDateGlossPlain(
        { ruler: '太祖', era: '建元', year: '三年', month: '正月' },
        'en',
      ),
    ).toBe('In Emperor Taizu, Jianyuan era, year 3, month I');
  });

  test('year month day gz without dynasty context', () => {
    expect(
      formatDateGlossPlain(
        { year: '三年', month: '十一月', day: '三日', gz: '壬戌' },
        'en',
      ),
    ).toBe('On year 3, month XI, day 3, renxu');
  });

  test('new moon on nmdgz then later day gz', () => {
    expect(
      formatDateGlossPlain(
        {
          year: '三年',
          month: '正月',
          nmdGz: '壬戌',
          lp: '朔',
          gz: '甲寅',
        },
        'en',
      ),
    ).toBe('On year 3, month I, new moon on renxu, day jiayin');
  });

  test('intercalary month', () => {
    expect(
      formatDateGlossPlain(
        { year: 3, month: 1, intercalary: true },
        'en',
      ),
    ).toBe('In year 3, intercalary month I');
  });

  test('晦 alone', () => {
    expect(formatDateGlossPlain({ year: 3, month: 1, lp: '晦' }, 'en')).toBe(
      'On year 3, month I, new moon eve',
    );
  });

  test('French day-level with dynasty', () => {
    const gloss = formatDateGlossPlain(
      {
        dyn: '南齊',
        ruler: '太祖',
        era: '建元',
        year: '三年',
        month: '正月',
        gz: '壬戌',
        lp: '朔',
        when: '0481-02-15',
      },
      'fr',
    );
    expect(gloss).toContain('Qi du Sud');
    expect(gloss).toContain('empereur Taizu');
    expect(gloss).toContain('ère Jianyuan');
    expect(gloss).toContain('nouvelle lune');
    expect(gloss).toContain('15 février 481');
  });

  test('builds input from attrs + children', () => {
    const input = dateGlossInputFromParts(
      { when: '0481-02-15', year: '3', month: '1', lp: '0', gz: '59' },
      {
        dyn: '南齊',
        ruler: '太祖',
        era: '建元',
        year: '三年',
        month: '正月',
        gz: '壬戌',
        lp: '朔',
      },
      '南齊太祖建元三年正月壬戌朔',
    );
    expect(formatDateGlossPlain(input, 'en')).toContain('Southern Qi');
    expect(formatDateGlossPlain(input, 'en')).toContain('15 February 481');
  });
});
