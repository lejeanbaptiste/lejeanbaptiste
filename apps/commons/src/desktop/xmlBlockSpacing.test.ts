import { separateBlockElements } from './xmlBlockSpacing';

describe('separateBlockElements', () => {
  test('separates glued sibling paragraphs with depth-matching indentation', () => {
    const input = '<TEI><text><body><p xml:id="p1">One</p><p xml:id="p2">Two</p></body></text></TEI>';
    const result = separateBlockElements(input);
    // body is 3 levels deep (TEI > text > body), so paragraphs indent 3 units
    expect(result).toContain('</p>\n      <p xml:id="p2">');
  });

  test('handles a self-closed empty paragraph from an end-of-paragraph split', () => {
    const input = '<body><p xml:id="p1">One</p><p xml:id="p2"/><p xml:id="p3">Three</p></body>';
    const result = separateBlockElements(input);
    expect(result).toContain('</p>\n  <p xml:id="p2"/>');
    expect(result).toContain('<p xml:id="p2"/>\n  <p xml:id="p3">');
  });

  test('indents closing block tags one level shallower than their children', () => {
    const input = '<text><body><p>One</p></body></text>';
    const result = separateBlockElements(input);
    expect(result).toBe('<text>\n  <body>\n    <p>One</p>\n  </body>\n</text>');
  });

  test('normalizes existing zero-indent block boundaries to the right depth', () => {
    const input = '<text><body><p>One</p>\n<p>Two</p>\n</body></text>';
    const result = separateBlockElements(input);
    expect(result).toContain('</p>\n    <p>Two</p>');
  });

  test('is idempotent', () => {
    const once = separateBlockElements(
      '<TEI><text><body><p>One</p><p>Two</p></body></text></TEI>',
    );
    expect(separateBlockElements(once)).toBe(once);
  });

  test('starts a new source line after <lb/>', () => {
    const input = '<p>line one<lb/>line two<lb break="no"/>line three</p>';
    const result = separateBlockElements(input);
    expect(result).toContain('<lb/>\nline two');
    expect(result).toContain('<lb break="no"/>\nline three');
  });

  test('never touches inline mixed content', () => {
    const input = '<p>Jean, <persName ref="#j">Jeff</persName> and <hi rend="bold">more</hi>.</p>';
    expect(separateBlockElements(input)).toBe(input);
  });

  test('never touches whitespace adjacent to inline elements', () => {
    const input = '<p><hi>bold</hi> <persName>Jeff</persName></p>';
    expect(separateBlockElements(input)).toBe(input);
  });

  test('leaves the XML declaration, comments, and header untouched', () => {
    const input =
      '<?xml version="1.0"?><TEI><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt></fileDesc></teiHeader><text><body><p>One</p></body></text></TEI>';
    const result = separateBlockElements(input);
    expect(result).toContain('<teiHeader><fileDesc><titleStmt><title>T</title>');
    expect(result).toContain('<?xml version="1.0"?><TEI>');
  });

  test('handles attribute values containing angle brackets', () => {
    const input = '<body><p rend="a>b">One</p><p>Two</p></body>';
    const result = separateBlockElements(input);
    expect(result).toContain('</p>\n  <p>Two</p>');
  });

  test('matches Orlando-style uppercase tags', () => {
    const input = '<BODY><P>One</P><P>Two</P></BODY>';
    const result = separateBlockElements(input);
    expect(result).toContain('</P>\n  <P>Two</P>');
  });
});
