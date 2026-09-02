/**
 * @jest-environment jsdom
 */
import {
  collectMentionsFromSourceUnitXml,
  deriveDisplaySpec,
  resolveMentionRole,
  resolveMentionsWithEntities,
} from './mentionContext';
import type { EntitySummary } from './entitySummary';

const CAI_YUE_XML =
  '<p xmlns="http://www.tei-c.org/ns/1.0">' +
  '<persName key="person-bf78">蔡約</persName>字' +
  '<persName type="courtesy" key="person-bf78">景撝</persName>，' +
  '<placeName key="place-552">濟陽</placeName>' +
  '<placeName key="place-632">考城</placeName>人也。祖' +
  '<persName key="person-acf">廓</persName>，宋' +
  '<roleName key="office-d12">祠部尚書</roleName>。父' +
  '<persName key="person-378">興宗</persName>，征西、儀同。' +
  '</p>';

const caiYue = (): EntitySummary => ({
  id: 'person-bf78',
  kind: 'person',
  names: [
    { lang: 'zh', text: '蔡約', type: 'primary', role: 'full' },
    { lang: 'zh', text: '景撝', type: 'courtesy', role: 'courtesy' },
    { lang: 'zh-Latn', text: 'Cai Yue', type: 'romanization' },
  ],
  primaryName: '蔡約',
  romanizedName: 'Cai Yue',
  translations: [],
  description: null,
  dates: { startYear: 440, endYear: 483, startPrecision: null, endPrecision: null },
  familyName: 'Cai',
  authorityIds: [],
  classification: null,
  workType: null,
});

const caiKuo = (): EntitySummary => ({
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
});

describe('collectMentionsFromSourceUnitXml', () => {
  test('collects one row per keyed span in document order (duplicate keys allowed)', () => {
    const mentions = collectMentionsFromSourceUnitXml(CAI_YUE_XML);
    expect(mentions).toHaveLength(7);
    expect(mentions[0]?.surface).toBe('蔡約');
    expect(mentions[1]?.surface).toBe('景撝');
    expect(mentions[1]?.teiType).toBe('courtesy');
    expect(mentions[2]?.surface).toBe('濟陽');
    expect(mentions[3]?.surface).toBe('考城');
    expect(mentions[4]?.surface).toBe('廓');
    expect(mentions.filter((m) => m.key === 'person-bf78')).toHaveLength(2);
  });
});

describe('resolveMentionRole', () => {
  test('courtesy and partial-given roles resolve from entity DB', () => {
    const mentions = collectMentionsFromSourceUnitXml(CAI_YUE_XML);
    const entities = new Map([
      ['person-bf78', caiYue()],
      ['person-acf', caiKuo()],
    ]);
    const resolved = resolveMentionsWithEntities(mentions, entities);
    expect(resolved[1]?.role).toBe('courtesy');
    expect(resolved[4]?.role).toBe('partial-given');
    expect(resolved[2]?.role).toBe('place-as-written');
    expect(resolved[5]?.role).toBe('office-as-written');
  });
});

describe('deriveDisplaySpec', () => {
  test('partial-given gets family brackets on first mention when policy allows', () => {
    const spec = deriveDisplaySpec('partial-given', 1, 'first-mention-only');
    expect(spec.bracketsAround).toBe('family');
    expect(deriveDisplaySpec('partial-given', 2, 'first-mention-only').bracketsAround).toBeNull();
    expect(deriveDisplaySpec('partial-given', 1, 'never').bracketsAround).toBeNull();
  });
});
