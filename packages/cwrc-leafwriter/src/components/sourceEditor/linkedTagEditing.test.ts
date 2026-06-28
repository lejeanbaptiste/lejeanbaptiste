import { findLinkedTagNameRanges } from './closingTagParser';

const getRangeText = (content: string, range: { start: number; end: number }) =>
  content.slice(range.start, range.end);

describe('findLinkedTagNameRanges', () => {
  test('returns opening and closing ranges for a paragraph tag', () => {
    const content = '<TEI><text><body><p>hello</p></body></text></TEI>';
    const openOffset = content.indexOf('p>hello');
    const closeOffset = content.indexOf('/p>');

    const fromOpen = findLinkedTagNameRanges(content, openOffset);
    expect(fromOpen).toHaveLength(2);
    expect(getRangeText(content, fromOpen![0]!)).toBe('p');
    expect(getRangeText(content, fromOpen![1]!)).toBe('p');

    const fromClose = findLinkedTagNameRanges(content, closeOffset + 1);
    expect(fromClose).toEqual(fromOpen);
  });

  test('returns ranges for prefixed tags', () => {
    const content = '<TEI><text><body><cb:div>text</cb:div></body></text></TEI>';
    const openOffset = content.indexOf('cb:div');
    const ranges = findLinkedTagNameRanges(content, openOffset + 2);

    expect(ranges).toHaveLength(2);
    expect(getRangeText(content, ranges![0]!)).toBe('cb:div');
    expect(getRangeText(content, ranges![1]!)).toBe('cb:div');
  });

  test('links only the innermost pair for nested same-name tags', () => {
    const content = '<div><div>inner</div></div>';
    const innerOpenOffset = content.indexOf('<div>inner');
    const outerCloseOffset = content.lastIndexOf('</div>') + 2;

    const innerRanges = findLinkedTagNameRanges(content, innerOpenOffset + 1);
    expect(getRangeText(content, innerRanges![0]!)).toBe('div');
    expect(innerRanges![0]!.start).toBe(content.indexOf('<div>inner') + 1);

    const outerRanges = findLinkedTagNameRanges(content, outerCloseOffset);
    expect(outerRanges![0]!.start).toBe(1);
    expect(outerRanges![1]!.start).toBe(content.lastIndexOf('</div>') + 2);
  });

  test('returns null for self-closing tags', () => {
    const content = '<TEI><text><body><pb/></body></text></TEI>';
    const offset = content.indexOf('pb') + 1;
    expect(findLinkedTagNameRanges(content, offset)).toBeNull();
  });

  test('returns null when the cursor is in text content', () => {
    const content = '<p>hello</p>';
    const offset = content.indexOf('hello') + 2;
    expect(findLinkedTagNameRanges(content, offset)).toBeNull();
  });

  test('returns null when the cursor is in an attribute value', () => {
    const content = '<p type="verse">hello</p>';
    const offset = content.indexOf('verse') + 2;
    expect(findLinkedTagNameRanges(content, offset)).toBeNull();
  });

  test('returns null for unclosed tags', () => {
    const content = '<TEI><text><body><p>hello';
    const offset = content.indexOf('<p>') + 1;
    expect(findLinkedTagNameRanges(content, offset)).toBeNull();
  });

  test('returns ranges while renaming when open and close names temporarily differ', () => {
    const content = '<head>I <potat>love</p> cats</head>';
    const openOffset = content.indexOf('<potat>') + 5;

    const ranges = findLinkedTagNameRanges(content, openOffset);
    expect(ranges).toHaveLength(2);
    expect(getRangeText(content, ranges![0]!)).toBe('potat');
    expect(getRangeText(content, ranges![1]!)).toBe('p');
  });

  test('returns ranges for structurally paired tags when names differ', () => {
    const content = '<p>hello</div>';
    const openOffset = content.indexOf('<p>') + 1;

    expect(findLinkedTagNameRanges(content, openOffset)).toBeNull();
  });

  test('does not link an incomplete nested tag with a parent closing tag', () => {
    const content = '多經<cat>卷<pb</cat>';
    const offset = content.indexOf('<pb') + 2;

    expect(findLinkedTagNameRanges(content, offset)).toBeNull();
  });

  test('does not link unrelated tag names inside element content', () => {
    const content = '<cat>卷<pb/>more</cat>';
    const offset = content.indexOf('<pb') + 2;

    expect(findLinkedTagNameRanges(content, offset)).toBeNull();
  });
});
