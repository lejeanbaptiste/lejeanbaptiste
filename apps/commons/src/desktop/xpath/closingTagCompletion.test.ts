import {
  getInnermostOpenTagName,
  getOpenTagStackBeforeCursor,
} from '../../../../../packages/cwrc-leafwriter/src/components/sourceEditor/closingTagParser';

describe('closingTagParser', () => {
  test('tracks open tags before cursor', () => {
    const xml = '<TEI><text><body><p>hello';
    const offset = xml.length;
    expect(getInnermostOpenTagName(xml, offset)).toBe('p');
    expect(getOpenTagStackBeforeCursor(xml, offset).map((t) => t.name)).toEqual([
      'TEI',
      'text',
      'body',
      'p',
    ]);
  });

  test('pops stack on closing tags', () => {
    const xml = '<TEI><text></TEI>';
    const offset = xml.indexOf('</TEI>') + 2;
    expect(getInnermostOpenTagName(xml, offset)).toBe('text');
  });
});
