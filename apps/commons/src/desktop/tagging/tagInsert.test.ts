import { findParagraphAncestor, shouldSplitSameTagAtCaret } from './tagInsert';

describe('shouldSplitSameTagAtCaret', () => {
  test('splits when inserting p inside p at collapsed caret', () => {
    expect(shouldSplitSameTagAtCaret('p', 'p', true, true)).toBe(true);
  });

  test('does not split when tags differ', () => {
    expect(shouldSplitSameTagAtCaret('p', 'persName', true, true)).toBe(false);
  });

  test('does not split with a range selection', () => {
    expect(shouldSplitSameTagAtCaret('p', 'p', false, true)).toBe(false);
  });

  test('does not split when caret is not in a text node', () => {
    expect(shouldSplitSameTagAtCaret('p', 'p', true, false)).toBe(false);
  });
});

describe('findParagraphAncestor', () => {
  test('finds p ancestor from nested inline text', () => {
    const doc = document.implementation.createHTMLDocument('');
    const p = doc.createElement('div');
    p.setAttribute('_tag', 'p');
    const inline = doc.createElement('span');
    inline.setAttribute('_tag', 'persName');
    const text = doc.createTextNode('Jean');
    inline.appendChild(text);
    p.appendChild(inline);
    doc.body.appendChild(p);

    expect(findParagraphAncestor(text, doc.body)?.getAttribute('_tag')).toBe('p');
  });
});
