import { ENGLISH_DEFAULTS } from './dateFormatSettings';
import {
  EMPTY_DISPLAY_SPEC,
  applyPossessiveSuffix,
  entityKindSupportsVernacularGloss,
  entityLikeFromNameEntries,
  familyAndGivenOf,
  formatDates,
  missingTranslationLangs,
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
  translations: [],
  description: null,
  dates: { startYear: 440, endYear: 483, startPrecision: null, endPrecision: null },
  familyName: 'Cui',
  authorityIds: [],
  classification: null,
  workType: null,
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

const place = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
  id: 'place-1',
  kind: 'place',
  names: [{ lang: 'zh-Hant', text: '建康' }, { lang: 'zh-Latn', text: 'Jiankang' }],
  primaryName: '建康',
  romanizedName: 'Jiankang',
  translations: [],
  description: null,
  dates: null,
  familyName: null,
  authorityIds: [],
  classification: null,
  workType: null,
  ...overrides,
});

const org = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
  id: 'org-1',
  kind: 'org',
  names: [{ lang: 'en', text: 'Hanlin Academy' }],
  primaryName: 'Hanlin Academy',
  romanizedName: 'Hanlin Academy',
  translations: [],
  description: null,
  dates: { startYear: 738, endYear: 907, startPrecision: null, endPrecision: null },
  familyName: null,
  authorityIds: [],
  classification: null,
  workType: null,
  ...overrides,
});

const office = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
  id: 'office-1',
  kind: 'office',
  names: [{ lang: 'en', text: 'Prefect of Jiankang' }],
  primaryName: 'Prefect of Jiankang',
  romanizedName: 'Prefect of Jiankang',
  translations: [],
  description: null,
  dates: null,
  familyName: null,
  authorityIds: [],
  classification: null,
  workType: null,
  ...overrides,
});

const work = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
  id: 'work-1',
  kind: 'work',
  names: [{ lang: 'en', text: 'Book of Song' }],
  primaryName: 'Book of Song',
  romanizedName: 'Book of Song',
  translations: [],
  description: null,
  dates: { startYear: 488, endYear: null, startPrecision: null, endPrecision: null },
  familyName: null,
  authorityIds: [],
  classification: null,
  workType: null,
  ...overrides,
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
    extraParts: [],
    bracketsAround: 'family',
    possessive: false,
    titleConvention: null,
  };

  test('brackets use square brackets around romanized family', () => {
    expect(renderEntityFromSpec(person(), 2, familyInBrackets, ENGLISH_DEFAULTS)).toBe('[Cui] Zusi');
  });

  test('first occurrence adds chinese and dates and keeps square brackets', () => {
    expect(renderEntityFromSpec(person(), 1, familyInBrackets, ENGLISH_DEFAULTS)).toBe(
      '[Cui] Zusi 崔祖思 (440–483)',
    );
  });

  test('first occurrence appends a translation gloss for the target language', () => {
    const entity = person({
      translations: [{ lang: 'fr', text: 'Cui le Patriote' }],
    });
    expect(renderEntityFromSpec(entity, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS, 'fr')).toBe(
      'Cui Zusi 崔祖思 (Cui le Patriote) (440–483)',
    );
  });

  test('translation-first leads with the gloss and parenthesizes original forms', () => {
    const entity = person({
      translations: [{ lang: 'fr', text: 'Cui le Patriote' }],
    });
    const spec: EntityDisplaySpec = {
      ...EMPTY_DISPLAY_SPEC,
      titleConvention: 'translation-first',
    };
    expect(renderEntityFromSpec(entity, 1, spec, ENGLISH_DEFAULTS, 'fr')).toBe(
      'Cui le Patriote (Cui Zusi 崔祖思) (440–483)',
    );
  });

  test('translation-first for a work title', () => {
    const entity = work({
      names: [
        { lang: 'zh-Hant', text: '晉書' },
        { lang: 'zh-Latn', text: 'Jinshu' },
      ],
      primaryName: '晉書',
      romanizedName: 'Jinshu',
      translations: [{ lang: 'fr', text: 'Livre des Jin' }],
      workType: 'book',
      dates: null,
    });
    const spec: EntityDisplaySpec = {
      ...EMPTY_DISPLAY_SPEC,
      titleConvention: 'translation-first',
    };
    expect(renderEntityFromSpec(entity, 1, spec, ENGLISH_DEFAULTS, 'fr')).toBe(
      'Livre des Jin (Jinshu 晉書)',
    );
  });

  test('legacy nameType=translation gloss still works when translations[] is empty', () => {
    const entity = person({
      names: [
        { lang: 'zh-Hant', text: '崔祖思', type: null },
        { lang: 'zh-Latn', text: 'Cui Zusi', type: null },
        { lang: 'fr', text: 'Cui le Patriote', type: 'translation' },
      ],
      translations: [],
    });
    expect(renderEntityFromSpec(entity, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS, 'fr')).toBe(
      'Cui Zusi 崔祖思 (Cui le Patriote) (440–483)',
    );
  });

  test('place romanization stored as romanization + zh-Latn leads the display', () => {
    const entity = place({
      names: [
        { lang: 'zh-Hant', text: '安陸縣', type: 'primary' },
        { lang: 'zh-Latn', text: 'Anlu', type: 'romanization' },
      ],
      primaryName: '安陸縣',
      romanizedName: 'Anlu',
    });
    expect(renderEntityFromSpec(entity, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS, 'fr')).toBe(
      'Anlu 安陸縣',
    );
  });

  test('legacy place romanization stored as translation + zh-Latn still leads the display', () => {
    // Pre-migration DB shape: setRomanizedName used to write name_type='translation'.
    const entity = place({
      names: [
        { lang: 'zh-Hant', text: '安陸縣', type: 'primary' },
        { lang: 'zh-Latn', text: 'Anlu', type: 'translation' },
      ],
      primaryName: '安陸縣',
      romanizedName: 'Anlu',
    });
    expect(renderEntityFromSpec(entity, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS, 'fr')).toBe(
      'Anlu 安陸縣',
    );
  });

  test('place romanization mis-tagged as zh-Hant translation is still used as the name', () => {
    // Legacy import quirk: Latin text under zh-Hant, no *-Latn row.
    const entity = place({
      names: [
        { lang: 'zh-Hant', text: '江南', type: 'primary' },
        { lang: 'zh-Hant', text: 'Jiang Nan', type: 'translation' },
      ],
      primaryName: '江南',
      romanizedName: null,
    });
    expect(renderEntityFromSpec(entity, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS, 'fr')).toBe(
      'Jiang Nan 江南',
    );
  });

  test('Latn translation rows are never used as the parenthetical gloss', () => {
    const entity = place({
      names: [
        { lang: 'zh-Hant', text: '安陸縣', type: 'primary' },
        { lang: 'zh-Latn', text: 'Anlu', type: 'romanization' },
      ],
      primaryName: '安陸縣',
      romanizedName: 'Anlu',
    });
    // Pane language zh would otherwise match primary subtag of zh-Latn.
    expect(renderEntityFromSpec(entity, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS, 'zh-Hant')).toBe(
      'Anlu 安陸縣',
    );
  });

  test('Lu Shao case: [Lu] Shao 陸邵 without dates', () => {
    const spec: EntityDisplaySpec = {
      hidden: ['dates'],
      bracketsAround: 'family',
      possessive: false,
      titleConvention: null,
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
      titleConvention: null,
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

  test('serialize/parse round-trips an explicit titleConvention', () => {
    const spec: EntityDisplaySpec = {
      ...EMPTY_DISPLAY_SPEC,
      titleConvention: 'translation-first',
    };
    const raw = serializeDisplaySpec(spec);
    expect(parseDisplaySpec(raw)).toEqual(spec);
  });

  test('parse drops legacy nameOrder field', () => {
    expect(
      parseDisplaySpec(
        '{"hidden":[],"bracketsAround":"family","possessive":false,"nameOrder":"given-family"}',
      ),
    ).toEqual(familyInBrackets);
  });
});

describe('non-person kinds render a single name part, not family/given', () => {
  test('place with no dates: bare name, no spurious split', () => {
    expect(renderEntityFromSpec(place(), 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe(
      'Jiankang 建康',
    );
    expect(renderEntityFromSpec(place(), 2, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe('Jiankang');
  });

  test('org has dates in its record but never shows them (dates are person/work only)', () => {
    expect(renderEntityFromSpec(org(), 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe(
      'Hanlin Academy',
    );
  });

  test('place likewise never shows a dates part even when dates are present', () => {
    const dated = place({
      dates: { startYear: 317, endYear: 420, startPrecision: null, endPrecision: null },
    });
    expect(renderEntityFromSpec(dated, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe('Jiankang 建康');
  });

  test('office likewise never shows a dates part even when dates are present', () => {
    const dated = office({
      dates: { startYear: 300, endYear: 400, startPrecision: null, endPrecision: null },
    });
    expect(renderEntityFromSpec(dated, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe(
      'Prefect of Jiankang',
    );
  });

  test('org with only one known year gets a neutral (no b./d.) date', () => {
    const oneSided = org({
      dates: { startYear: 738, endYear: null, startPrecision: null, endPrecision: null },
    });
    expect(formatDates(oneSided.dates, ENGLISH_DEFAULTS, { neutral: true })).toBe('738');
  });

  test('circa is preserved in neutral mode', () => {
    const circa = org({
      dates: { startYear: 738, endYear: null, startPrecision: 'b. ca.', endPrecision: null },
    });
    expect(formatDates(circa.dates, ENGLISH_DEFAULTS, { neutral: true })).toBe('ca. 738');
  });

  test('person single-sided date keeps the birth/death word (non-neutral by default)', () => {
    const bornOnly = person({
      dates: { startYear: 440, endYear: null, startPrecision: null, endPrecision: null },
    });
    expect(formatDates(bornOnly.dates, ENGLISH_DEFAULTS)).toBe('b. 440');
  });

  test('possessive still applies to the name part for a place', () => {
    const spec: EntityDisplaySpec = {
      hidden: ['chinese'],
      bracketsAround: null,
      possessive: true,
      titleConvention: null,
    };
    expect(renderEntityFromSpec(place(), 1, spec, ENGLISH_DEFAULTS, 'en')).toBe('Jiankang’s');
  });

  test('office shows its classification after the name on first occurrence only', () => {
    const withClassification = office({ classification: 'Capital prefecture' });
    expect(renderEntityFromSpec(withClassification, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe(
      'Prefect of Jiankang Capital prefecture',
    );
    expect(renderEntityFromSpec(withClassification, 2, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe(
      'Prefect of Jiankang',
    );
  });

  test('office with a gloss defaults to translation only (no pinyin or characters)', () => {
    const withGloss = office({
      names: [
        { lang: 'zh-Hant', text: '平北將軍' },
        { lang: 'zh-Latn', text: 'Pingbeijiangjun' },
      ],
      primaryName: '平北將軍',
      romanizedName: 'Pingbeijiangjun',
      translations: [{ lang: 'en', text: 'General Who Pacifies the North' }],
    });
    expect(renderEntityFromSpec(withGloss, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS, 'en')).toBe(
      'General Who Pacifies the North',
    );
    expect(renderEntityFromSpec(withGloss, 2, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS, 'en')).toBe(
      'General Who Pacifies the North',
    );
  });

  test('office gloss can reveal pinyin via extraParts', () => {
    const withGloss = office({
      names: [
        { lang: 'zh-Hant', text: '平北將軍' },
        { lang: 'zh-Latn', text: 'Pingbeijiangjun' },
      ],
      primaryName: '平北將軍',
      romanizedName: 'Pingbeijiangjun',
      translations: [{ lang: 'en', text: 'General Who Pacifies the North' }],
    });
    const revealed: EntityDisplaySpec = {
      ...EMPTY_DISPLAY_SPEC,
      extraParts: ['name', 'chinese'],
    };
    expect(renderEntityFromSpec(withGloss, 1, revealed, ENGLISH_DEFAULTS, 'en')).toBe(
      'General Who Pacifies the North Pingbeijiangjun 平北將軍',
    );
  });

  test('office romanization-first override keeps pinyin when a gloss exists', () => {
    const withGloss = office({
      names: [
        { lang: 'zh-Hant', text: '平北將軍' },
        { lang: 'zh-Latn', text: 'Pingbeijiangjun' },
      ],
      primaryName: '平北將軍',
      romanizedName: 'Pingbeijiangjun',
      translations: [{ lang: 'en', text: 'General Who Pacifies the North' }],
    });
    const romanized: EntityDisplaySpec = {
      ...EMPTY_DISPLAY_SPEC,
      titleConvention: 'romanization-first',
    };
    expect(renderEntityFromSpec(withGloss, 1, romanized, ENGLISH_DEFAULTS, 'en')).toBe(
      'Pingbeijiangjun 平北將軍 (General Who Pacifies the North)',
    );
  });

  test('office English gloss is usable when the pane language is French', () => {
    const withEnOnly = office({
      translations: [{ lang: 'en', text: 'General Who Pacifies the North' }],
    });
    expect(renderEntityFromSpec(withEnOnly, 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS, 'fr')).toBe(
      'General Who Pacifies the North',
    );
  });

  test('office with no classification renders just the name', () => {
    expect(renderEntityFromSpec(office(), 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe(
      'Prefect of Jiankang',
    );
  });

  test('work rendering is unchanged by the kind-aware refactor (regression)', () => {
    expect(renderEntityFromSpec(work(), 1, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe(
      'Book of Song (488)',
    );
    expect(renderEntityFromSpec(work(), 2, EMPTY_DISPLAY_SPEC, ENGLISH_DEFAULTS)).toBe('Book of Song');
  });
});

describe('entityKindSupportsVernacularGloss', () => {
  test('persons and places never get vernacular gloss UI; titles and labels do', () => {
    expect(entityKindSupportsVernacularGloss('person')).toBe(false);
    expect(entityKindSupportsVernacularGloss('place')).toBe(false);
    expect(entityKindSupportsVernacularGloss('work')).toBe(true);
    expect(entityKindSupportsVernacularGloss('office')).toBe(true);
    expect(entityKindSupportsVernacularGloss('org')).toBe(true);
    expect(entityKindSupportsVernacularGloss(null)).toBe(false);
  });
});

describe('missingTranslationLangs', () => {
  test('lists configured languages that lack a gloss', () => {
    const entity = work({
      translations: [{ lang: 'fr', text: 'Livre des Jin' }],
      dates: null,
    });
    expect(missingTranslationLangs(entity, ['fr', 'en', 'de'])).toEqual(['en', 'de']);
  });

  test('treats fr-FR as satisfied by a fr gloss', () => {
    const entity = work({
      translations: [{ lang: 'fr', text: 'Livre des Jin' }],
      dates: null,
    });
    expect(missingTranslationLangs(entity, ['fr-FR'])).toEqual([]);
  });

  test('reads legacy nameType=translation via entityLikeFromNameEntries', () => {
    const like = entityLikeFromNameEntries([
      { text: '晉書', lang: 'zh-Hant', type: 'primary' },
      { text: 'Livre des Jin', lang: 'fr', type: 'translation' },
    ]);
    expect(missingTranslationLangs(like, ['fr', 'en'])).toEqual(['en']);
  });

  test('skips blank codes and dedupes primary subtags', () => {
    const entity = person();
    expect(missingTranslationLangs(entity, ['', 'en', 'en-GB', 'fr'])).toEqual(['en', 'fr']);
  });
});
