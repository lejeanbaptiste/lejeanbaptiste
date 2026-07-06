import {
  areOtherAutoTaggingMethodsUnlocked,
  autoTaggingDocumentKey,
  countDocumentDates,
  defaultSanmiaoCivForLanguage,
  inferEastAsianLanguageFromText,
  isDisambiguationUnlockedForDocument,
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
  it('no longer gates other tagging methods', () => {
    expect(requiresDatesBeforeOtherTagging('zh-Hant')).toBe(false);
    expect(requiresDatesBeforeOtherTagging('ja')).toBe(false);
    expect(requiresDatesBeforeOtherTagging('en')).toBe(false);
  });
});

describe('areOtherAutoTaggingMethodsUnlocked', () => {
  const docKey = 'test-doc.xml';

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('is always true', () => {
    const doc = docFromTei('<p>x</p>', 'zh-Hant');
    expect(areOtherAutoTaggingMethodsUnlocked(docKey, doc, 'zh-Hant')).toBe(true);
    expect(areOtherAutoTaggingMethodsUnlocked(docKey, doc, 'en')).toBe(true);
  });
});

describe('isDisambiguationUnlockedForDocument', () => {
  it('is always true', () => {
    expect(isDisambiguationUnlockedForDocument('test-doc.xml', 'zh-Hant')).toBe(true);
    expect(isDisambiguationUnlockedForDocument('test-doc.xml', 'en')).toBe(true);
  });
});

describe('shouldWarnResolveDatesBeforeAutoTag', () => {
  it('never warns', () => {
    expect(shouldWarnResolveDatesBeforeAutoTag('test-doc.xml', 'zh-Hant')).toBe(false);
    markDatesPassRan('test-doc.xml');
    expect(shouldWarnResolveDatesBeforeAutoTag('test-doc.xml', 'zh-Hant')).toBe(false);
  });
});

describe('shouldWarnTagDatesFirst', () => {
  it('never warns', () => {
    expect(shouldWarnTagDatesFirst('test-doc.xml', 'zh-Hant')).toBe(false);
    markDatesPassRan('test-doc.xml');
    expect(shouldWarnTagDatesFirst('test-doc.xml', 'zh-Hant')).toBe(false);
  });
});

describe('defaultSanmiaoCivForLanguage', () => {
  it('defaults civ to project language', () => {
    expect(defaultSanmiaoCivForLanguage('zh-Hant')).toEqual(['c']);
    expect(defaultSanmiaoCivForLanguage('ja')).toEqual(['j']);
    expect(defaultSanmiaoCivForLanguage('ko')).toEqual(['k']);
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
