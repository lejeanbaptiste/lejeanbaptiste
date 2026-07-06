import {
  areOtherAutoTaggingMethodsUnlocked,
  autoTaggingDocumentKey,
  countDocumentDates,
  defaultSanmiaoCivForLanguage,
  documentHasDateMarkup,
  inferEastAsianLanguageFromDocument,
  inferEastAsianLanguageFromText,
  isDisambiguationUnlockedForDocument,
  markDatesPassApplied,
  markDatesPassRan,
  requiresDatesBeforeOtherTagging,
  resolveAutoTaggingSourceLanguage,
  shouldWarnResolveDatesBeforeAutoTag,
  shouldWarnTagDatesFirst,
  sourceLanguageFromDocument,
} from './dateWorkflow';

function docFromTei(inner: string, langIdent?: string): Document {
  const langBlock = langIdent
    ? `<profileDesc><langUsage><language ident="${langIdent}"/></langUsage></profileDesc>`
    : '';
  const xml = `<TEI xmlns="http://www.tei-c.org/ns/1.0">${langBlock}<text><body>${inner}</body></text></TEI>`;
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('sourceLanguageFromDocument', () => {
  it('reads profileDesc/langUsage/language@ident', () => {
    const doc = docFromTei('<p>x</p>', 'zh-Hant');
    expect(sourceLanguageFromDocument(doc)).toBe('zh-Hant');
  });
});

describe('inferEastAsianLanguageFromText', () => {
  it('detects Chinese literary prose', () => {
    const text = '義熙元年三月，帝崩。其三年，大将军北伐，至于河北。';
    expect(inferEastAsianLanguageFromText(text)).toBe('zh-Hans');
  });

  it('returns null for English prose', () => {
    const text =
      'In the year 405 the emperor died. The general marched north the following spring.';
    expect(inferEastAsianLanguageFromText(text)).toBeNull();
  });
});

describe('resolveAutoTaggingSourceLanguage', () => {
  it('prefers project metadata over the editor body', async () => {
    const doc = docFromTei('<p>x</p>');
    const lang = await resolveAutoTaggingSourceLanguage(doc, async () => 'ja');
    expect(lang).toBe('ja');
  });

  it('infers Chinese when metadata and header are absent', async () => {
    const doc = docFromTei('<p>義熙元年三月，帝崩。其三年，大将军北伐，至于河北。</p>');
    const lang = await resolveAutoTaggingSourceLanguage(doc, async () => null);
    expect(lang).toBe('zh-Hans');
  });
});

describe('requiresDatesBeforeOtherTagging', () => {
  it('is true for Chinese, Japanese, and Korean', () => {
    expect(requiresDatesBeforeOtherTagging('zh-Hant')).toBe(true);
    expect(requiresDatesBeforeOtherTagging('lzh')).toBe(true);
    expect(requiresDatesBeforeOtherTagging('ja')).toBe(true);
    expect(requiresDatesBeforeOtherTagging('ko')).toBe(true);
  });

  it('is false for English', () => {
    expect(requiresDatesBeforeOtherTagging('en')).toBe(false);
  });
});

describe('defaultSanmiaoCivForLanguage', () => {
  it('defaults civ to project language', () => {
    expect(defaultSanmiaoCivForLanguage('zh-Hant')).toEqual(['c']);
    expect(defaultSanmiaoCivForLanguage('ja')).toEqual(['j']);
    expect(defaultSanmiaoCivForLanguage('ko')).toEqual(['k']);
  });
});

describe('areOtherAutoTaggingMethodsUnlocked', () => {
  const docKey = 'test-doc.xml';

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('unlocks immediately for non-East-Asian languages', () => {
    const doc = docFromTei('<p>x</p>', 'en');
    expect(areOtherAutoTaggingMethodsUnlocked(docKey, doc, 'en')).toBe(true);
  });

  it('stays locked for Chinese until dates pass is recorded', () => {
    const doc = docFromTei('<p>x</p>', 'zh-Hant');
    expect(areOtherAutoTaggingMethodsUnlocked(docKey, doc, 'zh-Hant')).toBe(false);
    markDatesPassRan(docKey);
    expect(areOtherAutoTaggingMethodsUnlocked(docKey, doc, 'zh-Hant')).toBe(true);
  });

  it('does not unlock just because the body already has date elements', () => {
    const doc = docFromTei('<p><date>義熙元年</date></p>', 'zh-Hant');
    expect(documentHasDateMarkup(doc)).toBe(true);
    expect(areOtherAutoTaggingMethodsUnlocked(docKey, doc, 'zh-Hant')).toBe(false);
  });
});

describe('isDisambiguationUnlockedForDocument', () => {
  const docKey = 'test-doc.xml';

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('unlocks immediately for non-East-Asian languages', () => {
    expect(isDisambiguationUnlockedForDocument(docKey, 'en')).toBe(true);
  });

  it('stays locked until resolve is applied', () => {
    expect(isDisambiguationUnlockedForDocument(docKey, 'zh-Hant')).toBe(false);
    markDatesPassRan(docKey);
    expect(isDisambiguationUnlockedForDocument(docKey, 'zh-Hant')).toBe(false);
    markDatesPassApplied(docKey);
    expect(isDisambiguationUnlockedForDocument(docKey, 'zh-Hant')).toBe(true);
  });
});

describe('shouldWarnResolveDatesBeforeAutoTag', () => {
  const docKey = 'test-doc.xml';

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('warns after tag pass but before resolve', () => {
    expect(shouldWarnResolveDatesBeforeAutoTag(docKey, 'zh-Hant')).toBe(false);
    markDatesPassRan(docKey);
    expect(shouldWarnResolveDatesBeforeAutoTag(docKey, 'zh-Hant')).toBe(true);
    markDatesPassApplied(docKey);
    expect(shouldWarnResolveDatesBeforeAutoTag(docKey, 'zh-Hant')).toBe(false);
  });
});

describe('shouldWarnTagDatesFirst', () => {
  const docKey = 'test-doc.xml';

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('warns until tag pass is recorded', () => {
    expect(shouldWarnTagDatesFirst(docKey, 'zh-Hant')).toBe(true);
    markDatesPassRan(docKey);
    expect(shouldWarnTagDatesFirst(docKey, 'zh-Hant')).toBe(false);
  });

  it('is false for non-East-Asian languages', () => {
    expect(shouldWarnTagDatesFirst(docKey, 'en')).toBe(false);
  });
});

describe('countDocumentDates', () => {
  it('counts tagged and resolved dates', () => {
    const doc = docFromTei(
      '<p><date resp="#ljb-sanmiao" cert="low">義熙元年</date><date when="405-03-01">義熙元年三月</date></p>',
      'zh-Hant',
    );
    expect(countDocumentDates(doc)).toEqual({ tagged: 2, resolved: 1 });
  });
});

describe('autoTaggingDocumentKey', () => {
  it('prefers editor file path', () => {
    expect(
      autoTaggingDocumentKey({
        overmindState: {
          editor: { resource: { filePath: '/proj/chapter.xml' } },
          document: { url: 'blob:other' },
        },
      }),
    ).toBe('/proj/chapter.xml');
  });
});
