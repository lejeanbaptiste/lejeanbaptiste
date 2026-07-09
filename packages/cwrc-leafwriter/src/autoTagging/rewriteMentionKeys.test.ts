import { containsAnyKey, rewriteMentionKeys } from './rewriteMentionKeys';

describe('rewriteMentionKeys', () => {
  it('remaps a key to the surviving id', () => {
    const xml = '<p>豈<persName key="person-000014" resp="#ljb-autotag">禹</persName>罪己</p>';
    const result = rewriteMentionKeys(xml, { 'person-000014': 'person-000002' });
    expect(result.xml).toBe(
      '<p>豈<persName key="person-000002" resp="#ljb-autotag">禹</persName>罪己</p>',
    );
    expect(result.count).toBe(1);
    expect(result.changed).toBe(true);
  });

  it('strips the attribute when the remap value is null', () => {
    const xml = '<persName key="person-000014" resp="#x">禹</persName>';
    const result = rewriteMentionKeys(xml, { 'person-000014': null });
    expect(result.xml).toBe('<persName resp="#x">禹</persName>');
    expect(result.count).toBe(1);
  });

  it('handles single-quoted attributes', () => {
    const xml = "<persName key='person-000001'>曹爽</persName>";
    const result = rewriteMentionKeys(xml, { 'person-000001': 'person-000009' });
    expect(result.xml).toBe("<persName key='person-000009'>曹爽</persName>");
  });

  it('rewrites multiple occurrences across the document', () => {
    const xml =
      '<p><persName key="a">甲</persName>又<persName key="a">甲</persName>與<persName key="b">乙</persName></p>';
    const result = rewriteMentionKeys(xml, { a: 'z', b: null });
    expect(result.xml).toBe(
      '<p><persName key="z">甲</persName>又<persName key="z">甲</persName>與<persName>乙</persName></p>',
    );
    expect(result.count).toBe(3);
  });

  it('leaves unrelated keys and untouched files alone', () => {
    const xml = '<persName key="person-000005">刁協</persName>';
    const result = rewriteMentionKeys(xml, { 'person-000001': 'person-000002' });
    expect(result.xml).toBe(xml);
    expect(result.changed).toBe(false);
    expect(result.count).toBe(0);
  });

  it('does not touch key= text outside element tags', () => {
    const xml = '<p>Set key="person-000001" in the file.</p>';
    const result = rewriteMentionKeys(xml, { 'person-000001': 'person-000002' });
    expect(result.xml).toBe(xml);
    expect(result.changed).toBe(false);
  });

  it('does not rewrite inside comments', () => {
    const xml = '<!-- <persName key="a">x</persName> --><persName key="a">x</persName>';
    const result = rewriteMentionKeys(xml, { a: 'b' });
    expect(result.xml).toBe(
      '<!-- <persName key="a">x</persName> --><persName key="b">x</persName>',
    );
    expect(result.count).toBe(1);
  });

  it('ignores attributes that merely end in key=', () => {
    const xml = '<date sortkey="person-000001"/><persName key="person-000001">A</persName>';
    const result = rewriteMentionKeys(xml, { 'person-000001': 'x' });
    expect(result.xml).toBe('<date sortkey="person-000001"/><persName key="x">A</persName>');
    expect(result.count).toBe(1);
  });

  it('preserves surrounding whitespace and formatting exactly', () => {
    const xml = '<persName\n    key="a"\n    resp="#x">甲</persName>';
    const result = rewriteMentionKeys(xml, { a: 'b' });
    expect(result.xml).toBe('<persName\n    key="b"\n    resp="#x">甲</persName>');
  });
});

describe('containsAnyKey', () => {
  it('detects present keys cheaply', () => {
    const xml = '<persName key="person-000014">禹</persName>';
    expect(containsAnyKey(xml, ['person-000014'])).toBe(true);
    expect(containsAnyKey(xml, ['person-000015'])).toBe(false);
  });
});
