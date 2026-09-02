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
  test('courtesy mention romanizes surface, not canonical short name', () => {
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
    expect(preview).toContain('景撝');
  });

  test('partial given shows brackets on first file occurrence', () => {
    const m = mention({ key: 'person-acf', surface: '廓', role: 'partial-given' });
    const spec = deriveDisplaySpec('partial-given', 1, 'first-mention-only');
    const parts = buildWesternMentionParts(m, caiKuo, 1, spec, FRENCH_DEFAULTS, 'zh');
    expect(mentionPartsToPlainPreview(parts)).toMatch(/\[Cai\].*Kuo/);
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
