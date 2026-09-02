/**
 * @jest-environment jsdom
 */
import { FRENCH_DEFAULTS, CHINESE_DEFAULTS } from './dateFormatSettings';
import { deriveDisplaySpec } from './mentionContext';
import type { MentionContext } from './mentionContext';
import type { EntitySummary } from './entitySummary';
import {
  buildCjkMentionParts,
  buildWesternMentionParts,
  formatEntityDatesCjk,
  mentionPartsToPlainPreview,
} from './mentionRender';

const mention = (
  partial: Partial<MentionContext> & Pick<MentionContext, 'surface' | 'role' | 'key'>,
): MentionContext => ({
  index: 0,
  kind: 'person',
  teiTag: 'persName',
  teiType: null,
  placeholderRole: 'entity',
  ...partial,
});

const caiYue: EntitySummary = {
  id: 'person-bf78',
  kind: 'person',
  names: [
    { lang: 'zh', text: '蔡約', type: 'primary' },
    { lang: 'zh', text: '景撝', type: 'courtesy', role: 'courtesy' },
    { lang: 'zh-Latn', text: 'Cai Yue', type: 'romanization' },
  ],
  primaryName: '蔡約',
  romanizedName: 'Cai Yue',
  translations: [{ lang: 'fr', text: 'Tsai Yueh' }],
  description: null,
  dates: { startYear: 440, endYear: 483, startPrecision: null, endPrecision: null },
  familyName: 'Cai',
  authorityIds: [],
  classification: null,
  workType: null,
};

const caiKuo: EntitySummary = {
  id: 'person-acf',
  kind: 'person',
  names: [
    { lang: 'zh', text: '蔡廓', type: 'primary' },
    { lang: 'zh-Latn', text: 'Cai Kuo', type: 'romanization' },
    { lang: 'zh', text: '蔡', type: 'family', role: 'family' },
    { lang: 'zh', text: '廓', type: 'given', role: 'given' },
  ],
  primaryName: '蔡廓',
  romanizedName: 'Cai Kuo',
  translations: [],
  description: null,
  dates: null,
  familyName: 'Cai',
  authorityIds: [],
  classification: null,
  workType: null,
};

const jiyang: EntitySummary = {
  id: 'place-552',
  kind: 'place',
  names: [{ lang: 'zh-Latn', text: 'Jiyang' }],
  primaryName: '濟陽',
  romanizedName: 'Jiyang',
  translations: [],
  description: null,
  dates: null,
  familyName: null,
  authorityIds: [],
  classification: 'commandery',
  workType: null,
};

describe('mentionRender western (fr)', () => {
  test('courtesy mention romanizes surface as one concatenated word', () => {
    const m = mention({
      key: 'person-bf78',
      surface: '景撝',
      role: 'courtesy',
      teiType: 'courtesy',
    });
    const spec = deriveDisplaySpec('courtesy', 1, 'first-mention-only');
    const parts = buildWesternMentionParts(m, caiYue, 1, spec, FRENCH_DEFAULTS, 'zh');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).not.toContain('Cai Yue');
    expect(preview).toContain('Jinghui');
    expect(preview).not.toMatch(/Jing\s+Hui/);
    expect(preview).toContain('景撝');
  });

  test('courtesy after a prior same-key mention still keeps Chinese characters', () => {
    const m = mention({
      key: 'person-bf78',
      surface: '景撝',
      role: 'courtesy',
      teiType: 'courtesy',
    });
    const spec = deriveDisplaySpec('courtesy', 2, 'first-mention-only');
    // fileOccurrenceIndex 2 = second chip for Cai Yue in the unit (after 蔡約)
    const parts = buildWesternMentionParts(m, caiYue, 2, spec, FRENCH_DEFAULTS, 'zh', 'en');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).toContain('Jinghui');
    expect(preview).toContain('景撝');
    expect(preview).not.toMatch(/440|483/); // dates still only on first person mention
  });

  test('partial given shows brackets on first file occurrence', () => {
    const m = mention({ key: 'person-acf', surface: '廓', role: 'partial-given' });
    const spec = deriveDisplaySpec('partial-given', 1, 'first-mention-only');
    const parts = buildWesternMentionParts(m, caiKuo, 1, spec, FRENCH_DEFAULTS, 'zh');
    expect(mentionPartsToPlainPreview(parts)).toMatch(/\[Cai\].*Kuo/);
  });

  test('multi-character given name concatenates as one word (Xingzong, not Xing Zong)', () => {
    const xingzong: EntitySummary = {
      id: 'person-378',
      kind: 'person',
      names: [
        { lang: 'zh', text: '蔡興宗', type: 'primary' },
        { lang: 'zh-Latn', text: 'Cai Xingzong', type: 'romanization' },
        { lang: 'zh', text: '蔡', type: 'family', role: 'family' },
        { lang: 'zh', text: '興宗', type: 'given', role: 'given' },
      ],
      primaryName: '蔡興宗',
      romanizedName: 'Cai Xingzong',
      translations: [],
      description: null,
      dates: { startYear: 415, endYear: 472, startPrecision: null, endPrecision: null },
      familyName: 'Cai',
      authorityIds: [],
      classification: null,
      workType: null,
    };
    const m = mention({ key: 'person-378', surface: '興宗', role: 'partial-given' });
    const spec = deriveDisplaySpec('partial-given', 1, 'first-mention-only');
    const parts = buildWesternMentionParts(m, xingzong, 1, spec, FRENCH_DEFAULTS, 'zh', 'en');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).toContain('Xingzong');
    expect(preview).not.toMatch(/Xing\s+Zong/);
  });

  test('office with vernacular gloss shows translation only', () => {
    const office: EntitySummary = {
      id: 'office-d12',
      kind: 'office',
      names: [
        { lang: 'zh', text: '祠部尚書', type: 'primary' },
        { lang: 'en', text: 'Minister of Sacrifices', type: 'translation' },
      ],
      primaryName: '祠部尚書',
      romanizedName: 'Cibushangshu',
      translations: [{ lang: 'en', text: 'Minister of Sacrifices' }],
      description: null,
      dates: null,
      familyName: null,
      authorityIds: [],
      classification: null,
      workType: null,
    };
    const m = mention({
      key: 'office-d12',
      kind: 'office',
      surface: '祠部尚書',
      role: 'office-as-written',
    });
    const spec = deriveDisplaySpec('office-as-written', 1, 'first-mention-only');
    const parts = buildWesternMentionParts(m, office, 1, spec, FRENCH_DEFAULTS, 'zh', 'en');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).toBe('Minister of Sacrifices');
    expect(preview).not.toContain('祠部');
    expect(preview).not.toMatch(/Cibu/i);
  });

  test('office falls back to romanization + Chinese when no gloss', () => {
    const office: EntitySummary = {
      id: 'office-d12',
      kind: 'office',
      names: [{ lang: 'zh', text: '祠部尚書', type: 'primary' }],
      primaryName: '祠部尚書',
      romanizedName: null,
      translations: [],
      description: null,
      dates: null,
      familyName: null,
      authorityIds: [],
      classification: null,
      workType: null,
    };
    const m = mention({
      key: 'office-d12',
      kind: 'office',
      surface: '祠部尚書',
      role: 'office-as-written',
    });
    const spec = deriveDisplaySpec('office-as-written', 1, 'first-mention-only');
    const parts = buildWesternMentionParts(m, office, 1, spec, FRENCH_DEFAULTS, 'zh', 'en');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).toContain('祠部尚書');
    expect(preview).toMatch(/Cibu/i);
  });

  test('place uses surface romanization without admin classification', () => {
    const m = mention({
      key: 'place-552',
      kind: 'place',
      surface: '濟陽',
      role: 'place-as-written',
    });
    const spec = deriveDisplaySpec('place-as-written', 1, 'first-mention-only');
    const parts = buildWesternMentionParts(m, jiyang, 1, spec, FRENCH_DEFAULTS, 'zh');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).toContain('濟陽');
    expect(preview).not.toContain('commandery');
  });

  test('does not duplicate Chinese when target lang was passed as sourceLang', () => {
    const m = mention({
      key: 'place-552',
      kind: 'place',
      surface: '濟陽',
      role: 'place-as-written',
    });
    const spec = deriveDisplaySpec('place-as-written', 1, 'first-mention-only');
    const parts = buildWesternMentionParts(m, jiyang, 1, spec, FRENCH_DEFAULTS, 'en');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).toMatch(/Jiyang.*濟陽/);
    expect(preview).not.toMatch(/濟陽\s+濟陽/);
  });

  test('partial given does not duplicate Chinese characters', () => {
    const m = mention({ key: 'person-acf', surface: '廓', role: 'partial-given' });
    const spec = deriveDisplaySpec('partial-given', 1, 'first-mention-only');
    const parts = buildWesternMentionParts(m, caiKuo, 1, spec, FRENCH_DEFAULTS, 'en');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).toMatch(/\[Cai\].*Kuo.*廓/);
    expect(preview).not.toMatch(/廓\s+廓/);
  });

  test('second occurrence drops Chinese and dates', () => {
    const m = mention({ key: 'person-bf78', surface: '蔡約', role: 'full-name' });
    const spec = deriveDisplaySpec('full-name', 2, 'first-mention-only');
    const parts = buildWesternMentionParts(m, caiYue, 2, spec, FRENCH_DEFAULTS, 'zh');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).not.toContain('蔡約');
    expect(preview).not.toContain('440');
  });
});

describe('mentionRender CJK (zh-Hans)', () => {
  beforeAll(async () => {
    const { installScriptNormalization } = await import('./openccScriptNormalize');
    await installScriptNormalization();
  });

  test('no romanization; first occurrence includes CJK life dates', () => {
    const m = mention({ key: 'person-bf78', surface: '蔡約', role: 'full-name' });
    const spec = deriveDisplaySpec('full-name', 1, 'first-mention-only');
    const parts = buildCjkMentionParts(m, caiYue, 1, spec, CHINESE_DEFAULTS, 'zh-Hans');
    const preview = mentionPartsToPlainPreview(parts);
    expect(preview).not.toMatch(/Cai/i);
    expect(preview).toContain('蔡约');
    expect(preview).toContain('年');
  });

  test('partial given uses bracketed family character when policy allows', () => {
    const m = mention({ key: 'person-acf', surface: '廓', role: 'partial-given' });
    const spec = deriveDisplaySpec('partial-given', 1, 'first-mention-only');
    const parts = buildCjkMentionParts(m, caiKuo, 1, spec, CHINESE_DEFAULTS, 'zh-Hans');
    expect(mentionPartsToPlainPreview(parts)).toContain('（蔡）廓');
  });
});

describe('formatEntityDatesCjk', () => {
  test('formats Western years in Chinese typography', () => {
    expect(
      formatEntityDatesCjk(
        { startYear: 127, endYear: 200, startPrecision: null, endPrecision: null },
        CHINESE_DEFAULTS,
      ),
    ).toBe('（127～200年）');
  });
});
