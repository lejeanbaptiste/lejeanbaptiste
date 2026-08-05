import { ENGLISH_DEFAULTS } from './dateFormatSettings';
import {
  EMPTY_DISPLAY_SPEC,
  applyPossessiveSuffix,
  familyAndGivenOf,
  formatDates,
  parseDisplaySpec,
  possessiveStyleForLang,
  renderEntityFromSpec,
  renderEntityText,
  serializeDisplaySpec,
  type EntityDisplaySpec,
} from './entityDisplay';
import type { EntitySummary } from './entitySummary';

const person = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
  id: 'person-1',
  kind: 'person',
  names: [
    { lang: 'zh-Hant', text: '崔祖思' },
    { lang: 'zh-Latn', text: 'Cui Zusi' },
  ],
  primaryName: '崔祖思',
  romanizedName: 'Cui Zusi',
  description: null,
  dates: { startYear: 440, endYear: 483, startPrecision: null, endPrecision: null },
  familyName: 'Cui',
  authorityIds: [],
  ...overrides,
});

/** Matches the Lu Shao screenshot case: CJK familyName in the DB, Latin romanization. */
const luShao = (): EntitySummary =>
  person({
    id: 'person-lu',
    names: [
      { lang: 'zh-Hant', text: '陸邵' },
      { lang: 'zh-Latn', text: 'Lu Shao' },
    ],
    primaryName: '陸邵',
    romanizedName: 'Lu Shao',
    familyName: '陸',
    dates: { startYear: 420, endYear: 479, startPrecision: null, endPrecision: null },
  });

describe('renderEntityText (translation / Word shared rules)', () => {
  test('first occurrence defaults to romanized + Chinese + dates', () => {
    expect(renderEntityText(person(), 1, null, ENGLISH_DEFAULTS)).toBe('Cui Zusi 崔祖思 (440–483)');
  });

  test('subsequent occurrence defaults to the short name', () => {
    expect(renderEntityText(person(), 2, null, ENGLISH_DEFAULTS)).toBe('Cui Zusi');
  });

  test('formatDates renders a range', () => {
    expect(formatDates(person().dates, ENGLISH_DEFAULTS)).toBe('440–483');
  });

  test('family_only override', () => {
    expect(renderEntityText(person(), 3, 'family_only')).toBe('Cui');
  });
});

describe('familyAndGivenOf', () => {
  test('splits Latin familyName prefix', () => {
    expect(familyAndGivenOf(person())).toEqual({ family: 'Cui', given: 'Zusi' });
  });

  test('splits romanization when familyName is CJK', () => {
    expect(familyAndGivenOf(luShao())).toEqual({ family: 'Lu', given: 'Shao' });
  });
});

describe('possessiveStyleForLang', () => {
  test('maps languages to possessive styles', () => {
    expect(possessiveStyleForLang('en')).toBe('en-apostrophe-s');
    expect(possessiveStyleForLang('en-GB')).toBe('en-apostrophe-s');
    expect(possessiveStyleForLang('de')).toBe('de-genitive-s');
    expect(possessiveStyleForLang('fr')).toBe('none');
    expect(possessiveStyleForLang('es')).toBe('none');
  });

  test('applyPossessiveSuffix follows English and German orthography', () => {
    expect(applyPossessiveSuffix('Zusi', 'en-apostrophe-s')).toBe('Zusi’s');
    expect(applyPossessiveSuffix('Hans', 'en-apostrophe-s')).toBe('Hans’');
    expect(applyPossessiveSuffix('Zusi', 'de-genitive-s')).toBe('Zusis');
    expect(applyPossessiveSuffix('Max', 'de-genitive-s')).toBe('Max’');
    expect(applyPossessiveSuffix('Zusi', 'none')).toBe('Zusi');
  });
});

describe('renderEntityFromSpec', () => {
  const familyInBrackets: EntityDisplaySpec = {
    hidden: [],
    bracketsAround: 'family',
    possessive: false,
  };

  test('brackets use square brackets around romanized family', () => {
    expect(renderEntityFromSpec(person(), 2, familyInBrackets, ENGLISH_DEFAULTS)).toBe('[Cui] Zusi');
  });

  test('first occurrence adds chinese and dates and keeps square brackets', () => {
    expect(renderEntityFromSpec(person(), 1, familyInBrackets, ENGLISH_DEFAULTS)).toBe(
      '[Cui] Zusi 崔祖思 (440–483)',
    );
  });

  test('Lu Shao case: [Lu] Shao 陸邵 without dates', () => {
    const spec: EntityDisplaySpec = {
      hidden: ['dates'],
      bracketsAround: 'family',
      possessive: false,
    };
    expect(renderEntityFromSpec(luShao(), 1, spec, ENGLISH_DEFAULTS)).toBe('[Lu] Shao 陸邵');
  });

  test('possessive attaches after the last visible name part (English)', () => {
    const spec: EntityDisplaySpec = {
      ...familyInBrackets,
      possessive: true,
    };
    expect(renderEntityFromSpec(person(), 2, spec, ENGLISH_DEFAULTS, 'en')).toBe('[Cui] Zusi’s');
    expect(renderEntityFromSpec(person(), 1, spec, ENGLISH_DEFAULTS, 'en')).toBe(
      '[Cui] Zusi’s 崔祖思 (440–483)',
    );
  });

  test('German possessive uses genitive -s without apostrophe', () => {
    const spec: EntityDisplaySpec = {
      ...familyInBrackets,
      possessive: true,
    };
    expect(renderEntityFromSpec(person(), 2, spec, ENGLISH_DEFAULTS, 'de')).toBe('[Cui] Zusis');
  });

  test('French ignores possessive even when the flag is set', () => {
    const spec: EntityDisplaySpec = {
      ...familyInBrackets,
      possessive: true,
    };
    expect(renderEntityFromSpec(person(), 2, spec, ENGLISH_DEFAULTS, 'fr')).toBe('[Cui] Zusi');
  });

  test('hidden chinese stays hidden on first occurrence', () => {
    const spec: EntityDisplaySpec = {
      hidden: ['chinese'],
      bracketsAround: 'family',
      possessive: false,
    };
    expect(renderEntityFromSpec(person(), 1, spec, ENGLISH_DEFAULTS)).toBe('[Cui] Zusi (440–483)');
  });

  test('empty spec matches legacy first/later defaults', () => {
    expect(renderEntityFromSpec(person(), 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe(
      'Cui Zusi 崔祖思 (440–483)',
    );
    expect(renderEntityFromSpec(person(), 2, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe(
      'Cui Zusi',
    );
  });

  test('serialize/parse round-trip skips empty specs', () => {
    expect(serializeDisplaySpec(EMPTY_DISPLAY_SPEC)).toBeNull();
    const raw = serializeDisplaySpec(familyInBrackets);
    expect(raw).toEqual(expect.any(String));
    expect(parseDisplaySpec(raw)).toEqual(familyInBrackets);
  });

  test('parse drops legacy nameOrder field', () => {
    expect(
      parseDisplaySpec(
        '{"hidden":[],"bracketsAround":"family","possessive":false,"nameOrder":"given-family"}',
      ),
    ).toEqual(familyInBrackets);
  });
});
