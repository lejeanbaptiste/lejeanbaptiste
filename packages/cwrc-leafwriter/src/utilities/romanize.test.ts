import {
  autoRomanize,
  autoRomanizeForKind,
  canAutoRomanize,
  foldForSearch,
  isLatinScript,
  latnLangFor,
  romanizeFromAuthorityMetadata,
  splitPlaceAdminSuffix,
} from './romanize';

describe('latnLangFor', () => {
  it('maps a project language to its Latin-script counterpart', () => {
    expect(latnLangFor('zh-Hant')).toBe('zh-Latn');
    expect(latnLangFor('zh-Hans')).toBe('zh-Latn');
    expect(latnLangFor('lzh')).toBe('lzh-Latn');
    expect(latnLangFor('ja')).toBe('ja-Latn');
    expect(latnLangFor('bo')).toBe('bo-Latn');
  });

  it('falls back to und-Latn when the language is unknown', () => {
    expect(latnLangFor(null)).toBe('und-Latn');
    expect(latnLangFor('')).toBe('und-Latn');
  });
});

describe('canAutoRomanize', () => {
  it('supports Chinese, Literary Chinese, Tibetan, and Japanese', () => {
    expect(canAutoRomanize('zh-Hant')).toBe(true);
    expect(canAutoRomanize('lzh')).toBe(true);
    expect(canAutoRomanize('bo')).toBe(true);
    expect(canAutoRomanize('ja')).toBe(true);
  });

  it('rejects Korean, Latin-script, and missing languages', () => {
    expect(canAutoRomanize('ko')).toBe(false);
    expect(canAutoRomanize('en')).toBe(false);
    expect(canAutoRomanize(null)).toBe(false);
  });
});

describe('autoRomanize', () => {
  it('generates toneless capitalized pinyin for Chinese', () => {
    expect(autoRomanize('張衡', 'zh-Hant')).toBe('Zhang Heng');
    expect(autoRomanize('司馬遷', 'lzh')).toBe('Si Ma Qian');
  });

  it('generates Wylie for Tibetan', () => {
    expect(autoRomanize('བློ་བཟང་', 'bo')).toBe('Blo bzang');
  });

  it('generates Hepburn romaji for pure-kana Japanese', () => {
    expect(autoRomanize('ナツメ ソウセキ', 'ja')).toBe('Natsume Souseki');
    expect(autoRomanize('なつめ', 'ja')).toBe('Natsume');
  });

  it('refuses Japanese input containing kanji (readings cannot be guessed)', () => {
    expect(autoRomanize('夏目漱石', 'ja')).toBeNull();
    expect(autoRomanize('夏目 ソウセキ', 'ja')).toBeNull();
  });

  it('returns null for Latin input, Korean, and unsupported languages', () => {
    expect(autoRomanize('Zhang Heng', 'zh-Hant')).toBeNull();
    expect(autoRomanize('김부식', 'ko')).toBeNull();
    expect(autoRomanize('張衡', 'en')).toBeNull();
    expect(autoRomanize('  ', 'zh-Hant')).toBeNull();
  });

  it('concatenates syllables when asked', () => {
    expect(autoRomanize('晉書', 'zh-Hant', { concatenate: true })).toBe('Jinshu');
    expect(autoRomanize('建康郡', 'zh-Hant', { concatenate: true })).toBe('Jiankangjun');
  });
});

describe('autoRomanizeForKind', () => {
  it('leaves persons on syllable Title Case', () => {
    expect(autoRomanizeForKind('張衡', 'zh-Hant', 'person')).toBe('Zhang Heng');
    expect(autoRomanizeForKind('司馬遷', 'zh-Hant', null)).toBe('Si Ma Qian');
  });

  it('concatenates work / org / office titles', () => {
    expect(autoRomanizeForKind('晉書', 'zh-Hant', 'work')).toBe('Jinshu');
    expect(autoRomanizeForKind('道德經', 'zh-Hant', 'work')).toBe('Daodejing');
  });

  it('splits place admin suffixes as a lowercase trailing word', () => {
    expect(autoRomanizeForKind('建康郡', 'zh-Hant', 'place')).toBe('Jiankang jun');
    expect(autoRomanizeForKind('安陸縣', 'zh-Hant', 'place')).toBe('Anlu xian');
    expect(autoRomanizeForKind('永嘉郡', 'zh-Hant', 'place')).toBe('Yongjia jun');
  });

  it('concatenates places without a recognized admin suffix', () => {
    expect(autoRomanizeForKind('江南', 'zh-Hant', 'place')).toBe('Jiangnan');
    expect(autoRomanizeForKind('揚州', 'zh-Hant', 'place')).toBe('Yangzhou');
  });
});

describe('splitPlaceAdminSuffix', () => {
  it('detects trailing admin units', () => {
    expect(splitPlaceAdminSuffix('建康郡')).toEqual({ stem: '建康', suffixPinyin: 'jun' });
    expect(splitPlaceAdminSuffix('安陸縣')).toEqual({ stem: '安陸', suffixPinyin: 'xian' });
    expect(splitPlaceAdminSuffix('江南')).toBeNull();
  });
});


describe('romanizeFromAuthorityMetadata', () => {
  it('prefers authority-provided pinyin', () => {
    expect(
      romanizeFromAuthorityMetadata({ pinyin: 'An Dun' }, '安惇', 'zh-Hant'),
    ).toBe('An Dun');
  });

  it('converts NDL yomi katakana to Hepburn', () => {
    expect(
      romanizeFromAuthorityMetadata({ yomi: 'ナツメ ソウセキ' }, '夏目漱石', 'ja'),
    ).toBe('Natsume Souseki');
  });

  it('falls back to autogeneration from the primary name', () => {
    expect(romanizeFromAuthorityMetadata(undefined, '張衡', 'zh-Hant')).toBe('Zhang Heng');
  });

  it('returns null when nothing is derivable', () => {
    expect(romanizeFromAuthorityMetadata(undefined, '夏目漱石', 'ja')).toBeNull();
    expect(romanizeFromAuthorityMetadata(undefined, '김부식', 'ko')).toBeNull();
  });
});

describe('foldForSearch', () => {
  it('strips tone marks, case, and separators', () => {
    expect(foldForSearch('Zhāng Héng')).toBe('zhangheng');
    expect(foldForSearch('Zhang Heng')).toBe('zhangheng');
    expect(foldForSearch("Blo-bzang grags-pa")).toBe('blobzanggragspa');
    expect(foldForSearch("O'Brien")).toBe('obrien');
  });

  it('leaves CJK text intact', () => {
    expect(foldForSearch('張衡')).toBe('張衡');
  });
});

describe('isLatinScript', () => {
  it('accepts Latin with diacritics and rejects CJK/mixed', () => {
    expect(isLatinScript('Zhāng Héng')).toBe(true);
    expect(isLatinScript('張衡')).toBe(false);
    expect(isLatinScript('張衡 Zhang')).toBe(false);
    expect(isLatinScript('')).toBe(false);
  });
});
