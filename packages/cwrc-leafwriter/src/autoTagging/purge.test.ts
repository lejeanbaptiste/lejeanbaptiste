import { applyPurge } from './purge';

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');
const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc);

describe('applyPurge', () => {
  test('changes attributes without changing text or protected infrastructure', () => {
    const doc = parse('<root><persName key="B">劉<lb/>備</persName></root>');
    expect(
      applyPurge(doc, {
        string: '劉備',
        tagName: 'persName',
        replaceKey: { name: 'key', value: 'A' },
        changes: [{ name: 'type', value: 'person' }],
      }),
    ).toBe(1);
    expect(serialize(doc)).toContain('<persName key="A" type="person">劉<lb/>備</persName>');
  });

  test('purges a tag by unwrapping it and preserves child text', () => {
    const doc = parse('<root><p><persName>劉<lb/>備</persName></p></root>');
    expect(applyPurge(doc, { string: '劉備', tagName: 'persName', purgeTag: true })).toBe(1);
    expect(serialize(doc)).toContain('<p>劉<lb/>備</p>');
  });

  test('uses Unicode-aware regex captures in replacement attributes', () => {
    const doc = parse('<root><persName key="甲乙">甲乙</persName></root>');
    expect(
      applyPurge(doc, {
        string: '(甲)(\\w+)',
        regex: true,
        tagName: 'persName',
        changes: [{ name: 'key', value: '#2-\\1' }],
      }),
    ).toBe(1);
    expect(serialize(doc)).toContain('key="乙-甲"');
  });

  test('tags an untagged text match when find tag is none', () => {
    const doc = parse('<root><p>劉備在此</p></root>');
    expect(
      applyPurge(doc, {
        string: '劉備',
        tagName: '*',
        replaceTagName: 'persName',
        changes: [{ name: 'key', value: 'A' }],
      }),
    ).toBe(1);
    expect(serialize(doc)).toContain('<p><persName key="A">劉備</persName>在此</p>');
  });

  test('applies replacement key while creating a tag and while renaming one', () => {
    const untagged = parse('<root><p>AB</p></root>');
    expect(
      applyPurge(untagged, {
        string: '(A)(B)',
        regex: true,
        tagName: '*',
        replaceTagName: 'name',
        replaceKey: { name: 'key', value: '#2#1' },
      }),
    ).toBe(1);
    expect(serialize(untagged)).toContain('<name key="BA">AB</name>');

    const renamed = parse('<root><old>AB</old></root>');
    expect(
      applyPurge(renamed, {
        string: 'AB',
        tagName: 'old',
        replaceTagName: 'name',
        replaceKey: { name: 'key', value: 'A' },
      }),
    ).toBe(1);
    expect(serialize(renamed)).toContain('<name key="A">AB</name>');
  });

  test('does not create or rename tags where the schema rejects the parent', () => {
    const doc = parse('<root><p>AB</p></root>');
    expect(
      applyPurge(doc, {
        string: 'AB',
        tagName: '*',
        replaceTagName: 'persName',
        canInsertTag: (tag, parent) => tag === 'persName' && parent === 'text',
      }),
    ).toBe(0);
    expect(serialize(doc)).toContain('<p>AB</p>');
  });
});
