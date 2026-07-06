import {
  areOtherAutoTaggingMethodsUnlocked,
  autoTaggingDocumentKey,
  defaultSanmiaoCivForLanguage,
  documentHasDateMarkup,
  inferEastAsianLanguageFromDocument,
  inferEastAsianLanguageFromText,
  markDatesPassRan,
  requiresDatesBeforeOtherTagging,
  resolveAutoTaggingSourceLanguage,
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
  it('is true for Chinese and Japanese', () => {
    expect(requiresDatesBeforeOtherTagging('zh-Hant')).toBe(true);
    expect(requiresDatesBeforeOtherTagging('lzh')).toBe(true);
    expect(requiresDatesBeforeOtherTagging('ja')).toBe(true);
  });

  it('is false for English and Korean', () => {
    expect(requiresDatesBeforeOtherTagging('en')).toBe(false);
    expect(requiresDatesBeforeOtherTagging('ko')).toBe(false);
  });
});

describe('defaultSanmiaoCivForLanguage', () => {
  it('defaults civ to project language', () => {
    expect(defaultSanmiaoCivForLanguage('zh-Hant')).toEqual(['c']);
    expect(defaultSanmiaoCivForLanguage('ja')).toEqual(['j']);
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
