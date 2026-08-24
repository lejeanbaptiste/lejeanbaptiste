import { defaultChineseNameSegmenter } from './defaultChineseNameSegmenter';
import { autoRomanize } from '../utilities/romanize';

const romanize = (part: string) => autoRomanize(part, 'zh-Hant', { concatenate: true });

describe('defaultChineseNameSegmenter', () => {
  it('splits a common single-character surname from a 2-character given name', () => {
    const result = defaultChineseNameSegmenter({
      name: '周世雄',
      projectLang: 'zh-Hant',
      romanize,
    });
    expect(result).toEqual({
      familyName: '周',
      givenName: '世雄',
      romanizedName: 'Zhou Shixiong',
    });
  });

  it('splits a known compound surname as one unit', () => {
    const result = defaultChineseNameSegmenter({
      name: '歐陽修',
      projectLang: 'zh-Hant',
      romanize,
    });
    expect(result?.familyName).toBe('歐陽');
    expect(result?.givenName).toBe('修');
    expect(result?.romanizedName).toBe('Ouyang Xiu');
  });

  it('returns null for non-Chinese project languages', () => {
    expect(defaultChineseNameSegmenter({ name: '周世雄', projectLang: 'ja', romanize })).toBeNull();
    expect(defaultChineseNameSegmenter({ name: '周世雄', projectLang: null, romanize })).toBeNull();
  });

  it('returns null for names outside the plausible 2-4 character range', () => {
    expect(
      defaultChineseNameSegmenter({ name: '周', projectLang: 'zh-Hant', romanize }),
    ).toBeNull();
    expect(
      defaultChineseNameSegmenter({ name: '一二三四五', projectLang: 'zh-Hant', romanize }),
    ).toBeNull();
  });

  it('returns null for Latin dump placeholders like nan (not 姓 n + 名 an)', () => {
    expect(
      defaultChineseNameSegmenter({ name: 'nan', projectLang: 'zh-Hant', romanize }),
    ).toBeNull();
    expect(
      defaultChineseNameSegmenter({ name: 'NaN', projectLang: 'zh-Hant', romanize }),
    ).toBeNull();
  });
});
