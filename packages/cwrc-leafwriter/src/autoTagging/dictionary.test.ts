import { dictionaryTag, parseDictionaryTable } from './dictionary';
import { normalizeDomText } from './normalize';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

describe('parseDictionaryTable', () => {
  it('parses headerless CSV as string,tag', () => {
    expect(parseDictionaryTable('張衡,persName\n洛陽,placeName')).toEqual([
      { string: '張衡', tag: 'persName' },
      { string: '洛陽', tag: 'placeName' },
    ]);
  });

  it('parses TSV with a header row in any column order', () => {
    const entries = parseDictionaryTable('tag\tstring\npersName\t張衡');
    expect(entries).toEqual([{ string: '張衡', tag: 'persName' }]);
  });

  it('ignores extra columns (ids, metadata) — tag stage writes no ids', () => {
    const entries = parseDictionaryTable(
      'string,tag,attributes,entityId\n張衡,persName,type=historical;cert=high,p042',
    );
    expect(entries).toEqual([{ string: '張衡', tag: 'persName' }]);
  });

  it('reads an authority export with id columns as a plain string/tag list', () => {
    const entries = parseDictionaryTable('person_id,string,tag\n80160,張衡,persName');
    expect(entries).toEqual([{ string: '張衡', tag: 'persName' }]);
  });

  it('handles quoted fields containing the delimiter', () => {
    const entries = parseDictionaryTable('"Yang, Xiong",persName');
    expect(entries).toEqual([{ string: 'Yang, Xiong', tag: 'persName' }]);
  });

  it('skips blank lines and incomplete rows', () => {
    expect(parseDictionaryTable('張衡,persName\n\n只有一列\n')).toHaveLength(1);
  });
});

describe('dictionaryTag', () => {
  const TEI = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p>大浮黎土之中，浮黎再現。張衡居洛陽。</p>
</body></text></TEI>`;

  it('emits tag-only suggestions for every match (no ids at this stage)', () => {
    const doc = parse(TEI);
    const suggestions = dictionaryTag(
      doc,
      [
        { string: '張衡', tag: 'persName' },
        { string: '洛陽', tag: 'placeName' },
      ],
      'ignore',
      'test-table',
    );

    expect(suggestions).toHaveLength(2);
    const zhang = suggestions.find((s) => s.anchor.surface === '張衡')!;
    expect(zhang.tag).toBe('persName');
    expect(zhang.attributes).toBeUndefined();
    expect(zhang.sourceDetail).toBe('test-table');
    expect(zhang.rationale).toContain('test-table');
  });

  it('skips single-character strings by default (minLength 2)', () => {
    const doc = parse(TEI);
    const suggestions = dictionaryTag(doc, [{ string: '張', tag: 'persName' }], 'ignore');
    expect(suggestions).toHaveLength(0);
  });

  it('prefers longer strings: shorter entries never match inside a longer claim', () => {
    const doc = parse(TEI);
    const suggestions = dictionaryTag(
      doc,
      [
        { string: '浮黎', tag: 'placeName' },
        { string: '大浮黎土', tag: 'placeName' },
      ],
      'ignore',
    );

    const surfaces = suggestions.map((s) => s.anchor.surface).sort();
    // 大浮黎土 claims its span; the standalone 浮黎 later in the sentence still matches
    expect(surfaces).toEqual(['大浮黎土', '浮黎']);
    const standalone = suggestions.find((s) => s.anchor.surface === '浮黎')!;
    expect(standalone.anchor.contextAfter.startsWith('再現')).toBe(true);
  });

  it('never matches across tag boundaries', () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>張<hi>衡</hi>不匹配，張衡匹配。</p></TEI>',
    );
    const suggestions = dictionaryTag(doc, [{ string: '張衡', tag: 'persName' }], 'ignore');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.anchor.contextAfter.startsWith('匹配')).toBe(true);
  });

  it('skips text inside <date> elements', () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>洛陽 outside <date>洛陽 inside</date></p></body></text></TEI>',
    );
    const suggestions = dictionaryTag(doc, [{ string: '洛陽', tag: 'placeName' }], 'ignore');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.anchor.surface).toBe('洛陽');
    expect(suggestions[0]!.anchor.contextBefore).toContain('outside');
  });
});
