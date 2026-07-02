import {
  detectPasteAmbiguity,
  decodeHtmlEntities,
  hasAmbiguousLineBreaks,
  isLeafWriterClipboardPayload,
  looksLikeXml,
  textToLineBreakXml,
  textToParagraphHtml,
} from './pasteSpecial';

describe('pasteSpecial', () => {
  test('detects XML-looking text', () => {
    expect(looksLikeXml('<p>Hello</p>')).toBe(true);
    expect(looksLikeXml('<?xml version="1.0"?><p>Hello</p>')).toBe(true);
    expect(looksLikeXml('Hello <persName>Jeff</persName>.')).toBe(true);
    expect(looksLikeXml('Hello <world>')).toBe(false);
    expect(looksLikeXml('Hello &lt;persName&gt;Jeff&lt;/persName&gt;.')).toBe(true);
  });

  test('detects ambiguous single-line breaks', () => {
    expect(hasAmbiguousLineBreaks('line one\nline two')).toBe(true);
    expect(hasAmbiguousLineBreaks('line one\n\nline two')).toBe(false);
    expect(hasAmbiguousLineBreaks('one line')).toBe(false);
  });

  test('ignores Le Jean-Baptiste clipboard payloads', () => {
    expect(
      detectPasteAmbiguity({
        fromLeafWriter: true,
        text: '<p>Hello</p>',
      }),
    ).toBeNull();
  });

  test('detects external paste ambiguity', () => {
    expect(detectPasteAmbiguity({ fromLeafWriter: false, text: '<p>Hello</p>' })).toBe('xml');
    expect(
      detectPasteAmbiguity({
        fromLeafWriter: false,
        text: 'Jean, test, <persName>Jeff</persName>',
      }),
    ).toBe('xml');
    expect(detectPasteAmbiguity({ fromLeafWriter: false, text: 'a\nb' })).toBe('line-breaks');
  });

  test('decodes clipboard text once before transforms', () => {
    expect(decodeHtmlEntities('&lt;persName&gt;Jeff&lt;/persName&gt;')).toBe(
      '<persName>Jeff</persName>',
    );
  });

  test('builds paragraph HTML', () => {
    expect(textToParagraphHtml('a\nb\n\nc')).toBe('<p>a<br />b</p><p>c</p>');
  });

  test('builds line-break XML', () => {
    expect(textToLineBreakXml('a\nb < c')).toBe('<p>a<lb/>b &lt; c</p>');
  });

  test('recognizes clipboard marker payloads', () => {
    expect(isLeafWriterClipboardPayload('{"app":"le-jean-baptiste","version":1}')).toBe(true);
    expect(isLeafWriterClipboardPayload('{"app":"something-else","version":1}')).toBe(false);
  });
});
