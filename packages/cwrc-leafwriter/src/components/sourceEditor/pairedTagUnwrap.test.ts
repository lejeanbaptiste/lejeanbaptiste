import {
  applyDeleteRanges,
  findUnwrapTagPair,
  getMirroredNameDeleteEdits,
  unwrapTagPair,
} from './closingTagParser';

describe('paired tag unwrap parser', () => {
  test('findUnwrapTagPair for opening and closing delimiters', () => {
    const content = '<cat>卷</cat>';
    const openOffset = content.indexOf('<cat>') + 2;
    const closeOffset = content.indexOf('</cat>') + 3;

    const fromOpen = findUnwrapTagPair(content, openOffset);
    const fromClose = findUnwrapTagPair(content, closeOffset);

    expect(fromOpen).not.toBeNull();
    expect(fromClose).toEqual(fromOpen);
    expect(content.slice(fromOpen!.openDelimiter.start, fromOpen!.openDelimiter.end)).toBe(
      '<cat>',
    );
    expect(content.slice(fromOpen!.closeDelimiter.start, fromOpen!.closeDelimiter.end)).toBe(
      '</cat>',
    );
  });

  test('unwrapTagPair keeps inner content', () => {
    const content = '<cat>卷</cat>';
    const pair = findUnwrapTagPair(content, content.indexOf('cat') + 1);
    expect(pair).not.toBeNull();
    expect(unwrapTagPair(content, pair!)).toBe('卷');
  });

  test('supports prefixed tags', () => {
    const content = '<cb:div>text</cb:div>';
    const pair = findUnwrapTagPair(content, content.indexOf('cb:div') + 1);
    expect(pair).not.toBeNull();
    expect(unwrapTagPair(content, pair!)).toBe('text');
  });

  test('links only innermost pair for nested same-name tags', () => {
    const content = '<div><div>inner</div></div>';
    const innerOpen = findUnwrapTagPair(content, content.indexOf('<div>inner') + 2);
    const outerClose = findUnwrapTagPair(content, content.lastIndexOf('</div>') + 3);

    expect(innerOpen!.openDelimiter.start).toBe(content.indexOf('<div>inner'));
    expect(outerClose!.openDelimiter.start).toBe(0);
    expect(unwrapTagPair(content, innerOpen!)).toBe('<div>inner</div>');
    expect(unwrapTagPair(content, outerClose!)).toBe('<div>inner</div>');
  });

  test('returns null for self-closing tags', () => {
    const content = '<pb/>';
    expect(findUnwrapTagPair(content, content.indexOf('pb') + 1)).toBeNull();
  });

  test('returns null for incomplete nested markup inside cat', () => {
    const content = '多經<cat>卷<pb</cat>';
    expect(findUnwrapTagPair(content, content.indexOf('<pb') + 2)).toBeNull();
  });

  test('returns null for mismatched tag names', () => {
    const content = '<p>hello</div>';
    expect(findUnwrapTagPair(content, content.indexOf('<p>') + 1)).toBeNull();
    expect(findUnwrapTagPair(content, content.indexOf('/div>') + 1)).toBeNull();
  });

  test('returns null when rename would use prefix match only', () => {
    const content = '<potat>love</p>';
    expect(findUnwrapTagPair(content, content.indexOf('potat') + 1)).toBeNull();
  });

  test('mirrored backspace shrinks both tag names', () => {
    const content = '<cat>卷</cat>';
    const pair = findUnwrapTagPair(content, content.indexOf('cat') + 2)!;
    const edits = getMirroredNameDeleteEdits(content, pair, content.indexOf('t') + 1, true);

    expect(edits).not.toBe('unwrap');
    expect(applyDeleteRanges(content, edits as { start: number; end: number }[])).toBe(
      '<ca>卷</ca>',
    );
  });

  test('mirrored delete removes last character from both names then unwraps', () => {
    const content = '<c>卷</c>';
    const pair = findUnwrapTagPair(content, content.indexOf('c>') + 1)!;
    expect(getMirroredNameDeleteEdits(content, pair, content.indexOf('c>') + 1, true)).toBe(
      'unwrap',
    );
  });
});
