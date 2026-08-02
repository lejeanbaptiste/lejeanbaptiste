import { addEntity, createEntitiesScaffold, parseEntities } from '../autoTagging/entities';
import { getFamilyName, getGivenName } from '../autoTagging/entityOps';
import {
  clearAllPluginPersonNameSegmenters,
  registerPluginPersonNameSegmenter,
} from './personNameSegmenters';
import {
  applyPersonNameSplitToEntity,
  suggestPersonNameSplit,
  suggestPersonRomanization,
} from './personNameDefaults';

/** Mimics Norbert: splits on a known single-character surname table. */
function registerMockSurnameSegmenter(surnames: string[]): void {
  registerPluginPersonNameSegmenter('mock-norbert', ({ name, romanize }) => {
    const surname = surnames.find((candidate) => name.startsWith(candidate));
    if (!surname) return null;
    const familyName = surname;
    const givenName = name.slice(surname.length);
    if (!givenName) return null;
    const family = romanize(familyName);
    const given = romanize(givenName);
    return {
      familyName,
      givenName,
      romanizedName: family && given ? `${family} ${given}` : null,
    };
  });
}

describe('suggestPersonNameSplit / suggestPersonRomanization', () => {
  afterEach(() => {
    clearAllPluginPersonNameSegmenters();
  });

  it('splits family from a multi-syllable given name and romanizes as one concatenated word', () => {
    registerMockSurnameSegmenter(['李']);

    const split = suggestPersonNameSplit('李淳風', 'zh-Hant');
    expect(split?.familyName).toBe('李');
    expect(split?.givenName).toBe('淳風');

    // "Li Chunfeng", not "Li Chun Feng" — the given name is one word.
    expect(suggestPersonRomanization('李淳風', 'zh-Hant')).toBe('Li Chunfeng');
  });

  it('concatenates a compound (2-character) surname into one word', () => {
    registerMockSurnameSegmenter(['歐陽']);

    expect(suggestPersonRomanization('歐陽修', 'zh-Hant')).toBe('Ouyang Xiu');
  });

  it('falls back to the built-in default surname split when no plugin is registered', () => {
    const split = suggestPersonNameSplit('李淳風', 'zh-Hant');
    expect(split?.familyName).toBe('李');
    expect(split?.givenName).toBe('淳風');
    expect(suggestPersonRomanization('李淳風', 'zh-Hant')).toBe('Li Chunfeng');
  });

  it('romanizes a 3-character name as surname + concatenated given name (蕭滴冽 → Xiao Dilie)', () => {
    registerMockSurnameSegmenter(['蕭']);

    const split = suggestPersonNameSplit('蕭滴冽', 'zh-Hant');
    expect(split?.familyName).toBe('蕭');
    expect(split?.givenName).toBe('滴冽');
    // Not "Xiao Di Lie" — that is syllable-by-syllable autoRomanize of the whole string.
    expect(suggestPersonRomanization('蕭滴冽', 'zh-Hant')).toBe('Xiao Dilie');
  });

  it('falls back to the default split when a registered plugin has no entry for this name (e.g. Norbert without a stored pinyin reading)', () => {
    // Norbert-like plugin that only recognizes 李, declining every other name.
    registerMockSurnameSegmenter(['李']);

    const split = suggestPersonNameSplit('周世雄', 'zh-Hant');
    expect(split?.familyName).toBe('周');
    expect(split?.givenName).toBe('世雄');
    expect(suggestPersonRomanization('周世雄', 'zh-Hant')).toBe('Zhou Shixiong');
  });

  it('stores the split family/given name on the entity', () => {
    registerMockSurnameSegmenter(['李']);

    const doc = parseEntities(createEntitiesScaffold('test-db'));
    const { id } = addEntity(doc, 'person', { name: '李淳風' });

    const result = applyPersonNameSplitToEntity(doc, id, '李淳風', 'zh-Hant');
    expect(result?.familyName).toBe('李');
    expect(result?.givenName).toBe('淳風');

    expect(getFamilyName(doc, id)).toBe('李');
    expect(getGivenName(doc, id)).toBe('淳風');
  });
});
