import {
  findPunctuationBoundaryOffset,
  flattenEditorText,
  computePunctuationBoundaryMove,
  isBoundaryChar,
  isPunctuationBoundaryNavEvent,
} from './punctuationBoundaryNav';

describe('isBoundaryChar', () => {
  it('treats Chinese and Latin punctuation as boundaries', () => {
    expect(isBoundaryChar('，')).toBe(true);
    expect(isBoundaryChar('。')).toBe(true);
    expect(isBoundaryChar('？')).toBe(true);
    expect(isBoundaryChar('！')).toBe(true);
    expect(isBoundaryChar('、')).toBe(true);
    expect(isBoundaryChar('：')).toBe(true);
    expect(isBoundaryChar('.')).toBe(true);
    expect(isBoundaryChar(',')).toBe(true);
    expect(isBoundaryChar('?')).toBe(true);
    expect(isBoundaryChar('—')).toBe(true);
    expect(isBoundaryChar('「')).toBe(true);
    expect(isBoundaryChar('」')).toBe(true);
  });

  it('treats spaces and line breaks as boundaries', () => {
    expect(isBoundaryChar(' ')).toBe(true);
    expect(isBoundaryChar('\n')).toBe(true);
    expect(isBoundaryChar('\t')).toBe(true);
    expect(isBoundaryChar('　')).toBe(true); // ideographic space
  });

  it('does not treat letters or Han characters as boundaries', () => {
    expect(isBoundaryChar('a')).toBe(false);
    expect(isBoundaryChar('子')).toBe(false);
    expect(isBoundaryChar('1')).toBe(false);
  });
});

describe('findPunctuationBoundaryOffset', () => {
  const text = '子曰学而时习之不亦说乎？有朋自远方来，不亦乐乎？';

  it('moves forward to before the next punctuation', () => {
    const from = text.indexOf('时');
    const to = findPunctuationBoundaryOffset(text, from, 'forward');
    expect(to).toBe(text.indexOf('？'));
    expect(text.slice(0, to)).toBe('子曰学而时习之不亦说乎');
  });

  it('moves forward again to before the next punctuation', () => {
    const beforeFirst = text.indexOf('？');
    const to = findPunctuationBoundaryOffset(text, beforeFirst, 'forward');
    expect(to).toBe(text.indexOf('，'));
    expect(text.slice(0, to)).toBe('子曰学而时习之不亦说乎？有朋自远方来');
  });

  it('when sitting before punctuation, jumps to the next boundary', () => {
    const onMark = text.indexOf('？');
    const to = findPunctuationBoundaryOffset(text, onMark, 'forward');
    expect(to).toBe(text.indexOf('，'));
  });

  it('moves backward to before the previous punctuation', () => {
    const beforeComma = text.indexOf('，');
    const to = findPunctuationBoundaryOffset(text, beforeComma, 'backward');
    expect(to).toBe(text.indexOf('？'));
  });

  it('moves backward from mid-clause to start when there is no prior punctuation', () => {
    const from = text.indexOf('时');
    const to = findPunctuationBoundaryOffset(text, from, 'backward');
    expect(to).toBe(0);
  });

  it('treats consecutive punctuation as one boundary run (lands before the first)', () => {
    const run = '你好！！下句';
    const from = run.indexOf('你');
    const to = findPunctuationBoundaryOffset(run, from, 'forward');
    expect(to).toBe(run.indexOf('！'));
    expect(run.slice(0, to)).toBe('你好');
  });

  it('lands before a space when moving forward through Latin text', () => {
    const latin = 'hello world again';
    const from = latin.indexOf('e'); // inside hello
    const to = findPunctuationBoundaryOffset(latin, from, 'forward');
    expect(latin.slice(0, to)).toBe('hello');
    expect(latin[to]).toBe(' ');
  });

  it('treats punctuation followed by a newline as one boundary run', () => {
    const lines = '第一句。\n第二句';
    const from = lines.indexOf('第');
    const to = findPunctuationBoundaryOffset(lines, from, 'forward');
    expect(to).toBe(lines.indexOf('。'));
    expect(lines.slice(0, to)).toBe('第一句');
  });
});

describe('flattenEditorText + computePunctuationBoundaryMove', () => {
  const isBlock = (node: Node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    ['P', 'DIV'].includes((node as Element).tagName);

  it('inserts a virtual newline between block-level text nodes', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>甲。</p><p>乙</p>';
    const { text } = flattenEditorText(root, isBlock);
    expect(text).toBe('甲。\n乙');
  });

  it('moves across a paragraph break to before the linebreak boundary', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>甲乙</p><p>丙丁</p>';
    const firstText = root.querySelector('p')!.firstChild as Text;
    // caret mid first paragraph — next stop is the virtual newline between blocks
    const moved = computePunctuationBoundaryMove(
      root,
      { node: firstText, offset: 1 },
      'forward',
      isBlock,
    );
    expect(moved).not.toBeNull();
    // Lands at end of first paragraph text (before the virtual newline)
    expect(moved!.focus.node.data).toBe('甲乙');
    expect(moved!.focus.offset).toBe(2);
  });
});

describe('isPunctuationBoundaryNavEvent', () => {
  const arrow = (init: KeyboardEventInit) =>
    new KeyboardEvent('keydown', { code: 'ArrowRight', ...init });

  it('matches Option+Arrow on Mac', () => {
    expect(isPunctuationBoundaryNavEvent(arrow({ altKey: true }), true)).toBe(true);
  });

  it('matches Ctrl+Arrow on Windows/Linux', () => {
    expect(isPunctuationBoundaryNavEvent(arrow({ ctrlKey: true }), false)).toBe(true);
  });

  it('ignores plain arrows and Cmd+Arrow', () => {
    expect(isPunctuationBoundaryNavEvent(arrow({}), true)).toBe(false);
    expect(isPunctuationBoundaryNavEvent(arrow({ metaKey: true, altKey: true }), true)).toBe(
      false,
    );
  });
});
