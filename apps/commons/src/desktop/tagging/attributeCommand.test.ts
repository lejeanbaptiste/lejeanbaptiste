import { applyAttributeToTag, commitTagAttributes, readTagAttributes } from './attributeCommand';

describe('attributeCommand', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('readTagAttributes filters reserved names and maps id to xml:id', () => {
    const tag = document.createElement('span');
    tag.setAttribute('_tag', 'persName');
    tag.setAttribute(
      '_attributes',
      JSON.stringify({ ref: 'x', _tag: 'persName', key: 'k1', id: 'dom_1', 'xml:id': 'p1' }),
    );

    (window as unknown as { writer: unknown }).writer = {
      schemaManager: { getIdName: () => 'xml:id' },
      tagger: {
        getAttributesForTag: (el: Element) => JSON.parse(el.getAttribute('_attributes') ?? '{}'),
      },
    };

    expect(readTagAttributes(tag)).toEqual({ ref: 'x', key: 'k1', 'xml:id': 'p1' });
  });

  test('applyAttributeToTag rejects invalid xml:id values', () => {
    const tag = document.createElement('span');
    tag.setAttribute('id', 't1');
    tag.setAttribute('_tag', 'placeName');
    tag.setAttribute('_attributes', '{}');
    document.body.appendChild(tag);

    (window as unknown as { writer: unknown }).writer = {
      schemaManager: { getIdName: () => 'xml:id' },
      editor: { undoManager: { transact: (fn: () => void) => fn() }, getBody: () => document.body },
      tagger: {
        getAttributesForTag: () => ({}),
        getCurrentTag: () => [{ getAttribute: () => 't1' }],
        editStructureTag: jest.fn(),
      },
      event: () => ({ publish: jest.fn() }),
    };

    const result = applyAttributeToTag(tag, 'xml:id', '2invalid');
    expect(result.applied).toBe(false);
    expect(result.error).toMatch(/letter or underscore/i);
  });

  test('applyAttributeToTag merges and commits via tagger', () => {
    const tag = document.createElement('span');
    tag.setAttribute('id', 't1');
    tag.setAttribute('_tag', 'persName');
    tag.setAttribute('_attributes', '{}');
    document.body.appendChild(tag);

    const editStructureTag = jest.fn();
    const transact = jest.fn((fn: () => void) => fn());
    (window as unknown as { writer: unknown }).writer = {
      schemaManager: { getIdName: () => 'xml:id' },
      editor: { undoManager: { transact } },
      tagger: {
        getAttributesForTag: () => ({}),
        getCurrentTag: () => [{ getAttribute: () => 't1' }],
        editStructureTag,
      },
      event: () => ({ publish: jest.fn() }),
    };

    const result = applyAttributeToTag(tag, 'ref', 'http://example.org/p1');
    expect(result.applied).toBe(true);
    expect(editStructureTag).toHaveBeenCalledWith(
      expect.anything(),
      { ref: 'http://example.org/p1' },
      'persName',
    );
  });

  test('commitTagAttributes removes empty values', () => {
    const tag = document.createElement('span');
    tag.setAttribute('id', 't2');
    tag.setAttribute('_tag', 'persName');

    const editStructureTag = jest.fn();
    (window as unknown as { writer: unknown }).writer = {
      schemaManager: { getIdName: () => 'xml:id' },
      editor: { undoManager: { transact: (fn: () => void) => fn() } },
      tagger: {
        getCurrentTag: () => [{}],
        editStructureTag,
      },
      event: () => ({ publish: jest.fn() }),
    };

    commitTagAttributes(tag, { ref: 'http://x', key: '' });
    expect(editStructureTag).toHaveBeenCalledWith(expect.anything(), { ref: 'http://x' }, 'persName');
  });
});
