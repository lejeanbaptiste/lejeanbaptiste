import { buildDocIndex } from './anchor';
import { normalizeDomText } from './normalize';
import { findSelectionRangeInDocument, searchTextForDomRange } from './selectionScope';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

/** Editor-body stand-in: HTML div structure with the same text content. */
const editorBody = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('searchTextForDomRange', () => {
  it('returns the search text between two text-node boundaries', () => {
    const body = editorBody('<p>alpha</p><p>beta</p><p>gamma</p>');
    const [p1, , p3] = Array.from(body.children);
    const range = document.createRange();
    range.setStart(p1!.firstChild!, 2);
    range.setEnd(p3!.firstChild!, 3);

    const index = buildDocIndex(body, 'ignore');
    expect(searchTextForDomRange(index, range)).toBe('phabetagam');
  });

  it('includes whole text nodes fully inside the range', () => {
    const body = editorBody('<p>alpha</p><p>beta</p><p>gamma</p>');
    const range = document.createRange();
    range.selectNodeContents(body);

    const index = buildDocIndex(body, 'ignore');
    expect(searchTextForDomRange(index, range)).toBe('alphabetagamma');
  });

  it('returns empty for a collapsed range', () => {
    const body = editorBody('<p>alpha</p>');
    const range = document.createRange();
    range.setStart(body.firstChild!.firstChild!, 1);
    range.collapse(true);

    const index = buildDocIndex(body, 'ignore');
    expect(searchTextForDomRange(index, range)).toBe('');
  });

  it('applies the whitespace policy to boundary offsets', () => {
    const body = editorBody('<p>a b c</p>');
    const range = document.createRange();
    // Raw offsets 2..5 = "b c"; with policy "ignore" that is search text "bc".
    range.setStart(body.firstChild!.firstChild!, 2);
    range.setEnd(body.firstChild!.firstChild!, 5);

    const index = buildDocIndex(body, 'ignore');
    expect(searchTextForDomRange(index, range)).toBe('bc');
  });
});

describe('findSelectionRangeInDocument', () => {
  const doc = () =>
    parse('<TEI><text><body><p>alpha</p><p>beta</p><p>gamma</p></body></text></TEI>');

  it('locates the selected text in the document search text', () => {
    expect(findSelectionRangeInDocument(doc(), 'betagam', 'ignore')).toEqual({
      start: 5,
      end: 12,
    });
  });

  it('returns null when the text is not found or empty', () => {
    expect(findSelectionRangeInDocument(doc(), 'missing', 'ignore')).toBeNull();
    expect(findSelectionRangeInDocument(doc(), '', 'ignore')).toBeNull();
  });
});
