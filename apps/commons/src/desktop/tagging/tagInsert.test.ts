import {
  copyAttributesWithoutSchemaId,
  findParagraphAncestor,
  isAtEndOfElement,
  shouldSplitSameTagAtCaret,
} from './tagInsert';

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

describe('isAtEndOfElement', () => {
  const makeRange = (doc: Document, node: Node, offset: number): Range => {
    const range = doc.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    return range;
  };

  test('true when caret is at the very end of a simple paragraph', () => {
    const doc = document.implementation.createHTMLDocument('');
    const p = doc.createElement('p');
    const text = doc.createTextNode('Hello world');
    p.appendChild(text);
    doc.body.appendChild(p);

    expect(isAtEndOfElement(makeRange(doc, text, text.length), p)).toBe(true);
  });

  test('false when caret is one character before the end', () => {
    const doc = document.implementation.createHTMLDocument('');
    const p = doc.createElement('p');
    const text = doc.createTextNode('Hello world');
    p.appendChild(text);
    doc.body.appendChild(p);

    expect(isAtEndOfElement(makeRange(doc, text, text.length - 1), p)).toBe(false);
  });

  test('false when there is trailing text after a nested inline tag', () => {
    const doc = document.implementation.createHTMLDocument('');
    const p = doc.createElement('p');
    p.appendChild(doc.createTextNode('text '));
    const inline = doc.createElement('span');
    inline.setAttribute('_tag', 'persName');
    const name = doc.createTextNode('Jeff');
    inline.appendChild(name);
    p.appendChild(inline);
    p.appendChild(doc.createTextNode('.'));
    doc.body.appendChild(p);

    // caret right after "Jeff", inside the inline tag — but "." still follows in the paragraph
    expect(isAtEndOfElement(makeRange(doc, name, name.length), p)).toBe(false);
  });

  test('true when caret is at the end of a nested inline tag that is the last child', () => {
    const doc = document.implementation.createHTMLDocument('');
    const p = doc.createElement('p');
    p.appendChild(doc.createTextNode('text '));
    const inline = doc.createElement('span');
    inline.setAttribute('_tag', 'persName');
    const name = doc.createTextNode('Jeff');
    inline.appendChild(name);
    p.appendChild(inline);
    doc.body.appendChild(p);

    expect(isAtEndOfElement(makeRange(doc, name, name.length), p)).toBe(true);
  });

  test('false for a non-collapsed range', () => {
    const doc = document.implementation.createHTMLDocument('');
    const p = doc.createElement('p');
    const text = doc.createTextNode('Hello world');
    p.appendChild(text);
    doc.body.appendChild(p);

    const range = doc.createRange();
    range.setStart(text, 0);
    range.setEnd(text, text.length);

    expect(isAtEndOfElement(range, p)).toBe(false);
  });
});

describe('copyAttributesWithoutSchemaId', () => {
  const makePara = (attrs: Record<string, string>): Element => {
    const doc = document.implementation.createHTMLDocument('');
    const p = doc.createElement('div');
    for (const [name, value] of Object.entries(attrs)) p.setAttribute(name, value);
    return p;
  };

  test('strips xml:id from both the literal attribute and the _attributes JSON blob', () => {
    const source = makePara({
      _tag: 'p',
      id: 'dom_1',
      'xml:id': 'p1',
      _attributes: JSON.stringify({ 'xml:id': 'p1', rend: 'indent' }),
    });
    const target = makePara({});

    copyAttributesWithoutSchemaId(source, target);

    expect(target.getAttribute('_tag')).toBe('p');
    expect(target.getAttribute('id')).toBeNull();
    expect(target.getAttribute('xml:id')).toBeNull();
    expect(JSON.parse(target.getAttribute('_attributes') ?? '{}')).toEqual({ rend: 'indent' });
  });

  test('drops an unparseable _attributes blob rather than duplicating it', () => {
    const source = makePara({ _tag: 'p', _attributes: '{not json' });
    const target = makePara({});

    copyAttributesWithoutSchemaId(source, target);

    expect(target.getAttribute('_attributes')).toBeNull();
    expect(target.getAttribute('_tag')).toBe('p');
  });
});
