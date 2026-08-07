/**
 * @jest-environment jsdom
 */
import { sexagenaryToPinyin } from '../../dateAuthority/chineseNumerals';
import {
  dateGlossInputFromParts,
  formatDateGlossPlain,
  formatWesternMonthSpan,
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

describe('formatWesternMonthSpan', () => {
  test('months-only same year', () => {
    expect(formatWesternMonthSpan('0187-01-02', '0187-02-01', 'fr', 'months')).toBe(
      'janvier–février 187',
    );
    expect(formatWesternMonthSpan('0187-01-02', '0187-02-01', 'en', 'months')).toBe(
      'January–February 187',
    );
  });

  test('full span same year', () => {
    expect(formatWesternMonthSpan('0187-01-02', '0187-02-01', 'fr', 'full')).toBe(
      '2 janvier–1 février 187',
    );
    expect(formatWesternMonthSpan('0187-01-02', '0187-02-01', 'en', 'full')).toBe(
      '2 January–1 February 187',
    );
  });

  test('cross-year months and full', () => {
    expect(formatWesternMonthSpan('0186-12-15', '0187-01-14', 'en', 'months')).toBe(
      'December 186–January 187',
    );
    expect(formatWesternMonthSpan('0186-12-15', '0187-01-14', 'en', 'full')).toBe(
      '15 December 186–14 January 187',
    );
  });
});

const resolvedDay = {
  year: '三年',
  month: '二月',
  gz: '乙未',
  when: '0479-03-27',
} as const;

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
      'Southern Qi, Emperor Taizu, Jianyuan era, year 3, month I, day renxu, new moon (15 February 481)',
    );
  });

  test('year-only with emperor and era', () => {
    expect(
      formatDateGlossPlain({ ruler: '太祖', era: '建元', year: '三年' }, 'en'),
    ).toBe('Emperor Taizu, Jianyuan era, year 3');
  });

  test('year and month', () => {
    expect(
      formatDateGlossPlain(
        { ruler: '太祖', era: '建元', year: '三年', month: '正月' },
        'en',
      ),
    ).toBe('Emperor Taizu, Jianyuan era, year 3, month I');
  });

  test('year month day gz without dynasty context', () => {
    expect(
      formatDateGlossPlain(
        { year: '三年', month: '十一月', day: '三日', gz: '壬戌' },
        'en',
      ),
    ).toBe('year 3, month XI, day 3, renxu');
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
    ).toBe('year 3, month I, new moon on renxu, day jiayin');
  });

  test('intercalary month', () => {
    expect(
      formatDateGlossPlain(
        { year: 3, month: 1, intercalary: true },
        'en',
      ),
    ).toBe('year 3, intercalary month I');
  });

  test('晦 alone', () => {
    expect(formatDateGlossPlain({ year: 3, month: 1, lp: '晦' }, 'en')).toBe(
      'year 3, month I, new moon eve',
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

  test('resolved day: translation+western (default) appends Western in parentheses', () => {
    expect(formatDateGlossPlain(resolvedDay, 'en')).toBe(
      'year 3, month II, day yiwei (27 March 479)',
    );
    expect(formatDateGlossPlain(resolvedDay, 'en', 'translation+western')).toBe(
      'year 3, month II, day yiwei (27 March 479)',
    );
  });

  test('resolved day: translation mode omits Western', () => {
    expect(formatDateGlossPlain(resolvedDay, 'en', 'translation')).toBe(
      'year 3, month II, day yiwei',
    );
  });

  test('resolved day: western mode is square brackets only', () => {
    expect(formatDateGlossPlain(resolvedDay, 'en', 'western')).toBe('[27 March 479]');
  });

  test('unresolved day-level: western mode falls back to EA gloss', () => {
    expect(
      formatDateGlossPlain(
        { year: '三年', month: '二月', gz: '乙未' },
        'en',
        'western',
      ),
    ).toBe('year 3, month II, day yiwei');
  });

  test('year-only never gets Western for any mode', () => {
    const yearOnly = { year: '元年' };
    expect(formatDateGlossPlain(yearOnly, 'en', 'translation+western')).toBe('year 1');
    expect(formatDateGlossPlain(yearOnly, 'en', 'translation')).toBe('year 1');
    expect(formatDateGlossPlain(yearOnly, 'en', 'western')).toBe('year 1');
  });

  test('month-only span: translation+western with months style (default)', () => {
    expect(
      formatDateGlossPlain(
        {
          year: '十八年',
          month: '二月',
          notBefore: '0213-03-10',
          notAfter: '0213-04-07',
        },
        'en',
        'translation+western',
        'months',
      ),
    ).toBe('year 18, month II (March–April 213)');
  });

  test('month-only span: full style', () => {
    expect(
      formatDateGlossPlain(
        {
          year: '十八年',
          month: '二月',
          notBefore: '0213-03-10',
          notAfter: '0213-04-07',
        },
        'fr',
        'translation+western',
        'full',
      ),
    ).toBe('l’an 18, mois II (10 mars–7 avril 213)');
  });

  test('month-only span: western mode uses square brackets', () => {
    expect(
      formatDateGlossPlain(
        {
          year: '十八年',
          month: '二月',
          notBefore: '0187-01-02',
          notAfter: '0187-02-01',
        },
        'fr',
        'western',
        'months',
      ),
    ).toBe('[janvier–février 187]');
  });

  test('month-only span: translation mode omits Western', () => {
    expect(
      formatDateGlossPlain(
        {
          year: '十八年',
          month: '二月',
          notBefore: '0213-03-10',
          notAfter: '0213-04-07',
        },
        'en',
        'translation',
        'full',
      ),
    ).toBe('year 18, month II');
  });

  test('month-only with Sanmiao nmd_gz still uses span, not day-level', () => {
    // Real TEI: month-only resolve keeps nmd_gz + notBefore/notAfter, no @when.
    expect(
      formatDateGlossPlain(
        {
          year: '2',
          month: '五月',
          nmdGz: '33',
          notBefore: '0480-05-25',
          notAfter: '0480-06-23',
        },
        'en',
        'translation+western',
        'months',
      ),
    ).toBe('year 2, month V (May–June 480)');
  });
});
