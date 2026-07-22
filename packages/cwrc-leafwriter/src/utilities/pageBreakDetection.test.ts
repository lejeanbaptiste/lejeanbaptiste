import { resolvePageBreakMarkers, tagPageBreaks } from './pageBreakDetection';

const resolveAll = (paragraphs: string[]): string[] =>
  paragraphs.map((paragraph) => {
    const resolved = resolvePageBreakMarkers(paragraph, (v) => v, (n) => `<pb n="${n}"/>`);
    return 'soleMarker' in resolved ? resolved.soleMarker : resolved.text;
  });

describe('tagPageBreaks', () => {
  test('heals a paragraph split by a bare page number with no preceding punctuation', () => {
    const tagged = tagPageBreaks('This sentence continues\n12\nacross the break.');
    const paragraphs = resolveAll(tagged.split(/\n{2,}/).map((p) => p.trim()));
    expect(paragraphs).toEqual(['This sentence continues <pb n="12"/> across the break.']);
  });

  test('leaves a real paragraph break intact when preceding text ends in punctuation', () => {
    const tagged = tagPageBreaks('This sentence ends here.\n\n12\n\nA new paragraph starts.');
    const paragraphs = resolveAll(tagged.split(/\n{2,}/).map((p) => p.trim()));
    expect(paragraphs).toEqual([
      'This sentence ends here.',
      '<pb n="12"/>',
      'A new paragraph starts.',
    ]);
  });

  test('accepts Latin-annotated page numbers in CJK text, ignoring CJK-scripted lines', () => {
    const tagged = tagPageBreaks('句子还没有结束\np. 12\n继续到这里。');
    const paragraphs = resolveAll(tagged.split(/\n{2,}/).map((p) => p.trim()));
    expect(paragraphs).toEqual(['句子还没有结束 <pb n="12"/> 继续到这里。']);
  });

  test('recognizes CJK sentence-final punctuation for a real break', () => {
    const tagged = tagPageBreaks('句子在这里结束。\n\n12\n\n新的段落开始了。');
    const paragraphs = resolveAll(tagged.split(/\n{2,}/).map((p) => p.trim()));
    expect(paragraphs).toEqual(['句子在这里结束。', '<pb n="12"/>', '新的段落开始了。']);
  });

  test('accepts gaps in the sequence but rejects back-and-forth jumps', () => {
    const tagged = tagPageBreaks(
      'Page one.\n\n10\n\nPage two.\n\n3\n\nPage three.\n\n12\n\nPage four.',
    );
    // "3" breaks the ascending run (10, 3, 12) so it is left as ordinary text,
    // while 10 and 12 are still recognized as page numbers.
    const paragraphs = resolveAll(tagged.split(/\n{2,}/).map((p) => p.trim()));
    expect(paragraphs).toEqual([
      'Page one.',
      '<pb n="10"/>',
      'Page two.',
      '3',
      'Page three.',
      '<pb n="12"/>',
      'Page four.',
    ]);
  });

  test('leaves text untouched when no numeral lines are present', () => {
    const text = 'Just a plain paragraph.\n\nAnother one, unrelated to pagination.';
    expect(tagPageBreaks(text)).toBe(text);
  });

  test('does not treat a numeral embedded mid-line as a page number', () => {
    const text = 'This chapter has 12 sections in total.\n\nAnd continues normally.';
    expect(tagPageBreaks(text)).toBe(text);
  });
});
