import { applySuggestions } from './apply';
import { dictionaryTagProjection } from './dictionary';
import { normalizeDomText } from './normalize';
import { surfaceAlongSiblingRun, wrapProjectionRange } from './projectionApply';
import type { Suggestion } from './types';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc);

const TEI_WRAP = (body: string) =>
  `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>${body}</body></text></TEI>`;

describe('wrapProjectionRange', () => {
  it('wraps text split by lb with the milestone preserved inside the tag', () => {
    const doc = parse(TEI_WRAP('<p>《般舟三<lb n="0324b25"/>昧》</p>'));
    const p = doc.getElementsByTagName('p')[0]!;
    const start = p.childNodes[0] as Text;
    const end = p.childNodes[2] as Text;

    const element = wrapProjectionRange(doc, start, 1, end, 1, {
      id: 't1',
      source: 'dictionary',
      action: 'add',
      tag: 'title',
      anchor: {
        documentId: '',
        xpath: '',
        offset: 1,
        surface: '般舟三昧',
        occurrence: 1,
        contextBefore: '',
        contextAfter: '',
        nodeHash: '',
      },
      status: 'pending',
    });

    expect(element.localName).toBe('title');
    expect(element.textContent).toBe('般舟三昧');
    expect(element.getElementsByTagName('lb')).toHaveLength(1);
    expect(p.textContent).toBe('《般舟三昧》');
  });

  it('wraps corr text split by lb inside choice, leaving sic untouched', () => {
    const doc = parse(
      TEI_WRAP('<p><choice><sic>王尭</sic><corr>王<lb/>堯</corr></choice></p>'),
    );
    const corr = doc.getElementsByTagName('corr')[0]!;
    const start = corr.childNodes[0] as Text;
    const end = corr.childNodes[2] as Text;

    wrapProjectionRange(doc, start, 0, end, 1, {
      id: 't2',
      source: 'dictionary',
      action: 'add',
      tag: 'persName',
      anchor: {
        documentId: '',
        xpath: '',
        offset: 0,
        surface: '王堯',
        occurrence: 1,
        contextBefore: '',
        contextAfter: '',
        nodeHash: '',
      },
      status: 'pending',
    });

    const sic = doc.getElementsByTagName('sic')[0]!;
    const persName = corr.getElementsByTagName('persName')[0]!;
    expect(sic.textContent).toBe('王尭');
    expect(persName.textContent).toBe('王堯');
    expect(persName.getElementsByTagName('lb')).toHaveLength(1);
  });
});

describe('surfaceAlongSiblingRun', () => {
  it('reconstructs projection surface across lb', () => {
    const doc = parse(TEI_WRAP('<p>《般舟三<lb/>昧》</p>'));
    const p = doc.getElementsByTagName('p')[0]!;
    const start = p.childNodes[0] as Text;
    const end = p.childNodes[2] as Text;

    expect(surfaceAlongSiblingRun(start, 1, end, 1, 'ignore')).toBe('般舟三昧');
  });
});

describe('applySuggestions projection spans', () => {
  const applyProjectionSuggestion = async (doc: Document, suggestion: Suggestion) => {
    const before = doc.documentElement?.textContent?.length ?? 0;
    const { applied, textIntegrityWarning } = await applySuggestions(doc, [suggestion], {
      policy: 'ignore',
    });
    const after = doc.documentElement?.textContent?.length ?? 0;
    expect(textIntegrityWarning).toBeUndefined();
    expect(after).toBe(before);
    return applied;
  };

  it('applies a dictionary projection hit across lb (CBETA acceptance case)', async () => {
    const doc = parse(TEI_WRAP('<p>《般舟三<lb n="0324b25"/>昧》</p>'));
    const [suggestion] = dictionaryTagProjection(
      doc,
      [{ string: '般舟三昧', tag: 'title' }],
      'ignore',
    );
    expect(suggestion).toBeDefined();

    expect(await applyProjectionSuggestion(doc, suggestion!)).toBe(1);

    const title = doc.getElementsByTagName('title')[0]!;
    expect(title.textContent).toBe('般舟三昧');
    expect(title.getElementsByTagName('lb')).toHaveLength(1);
    expect(serialize(doc)).toContain('<title>般舟三<lb');
  });

  it('applies a persName across pb', async () => {
    const doc = parse(TEI_WRAP('<p>王<pb n="0324b26"/>安石</p>'));
    const [suggestion] = dictionaryTagProjection(doc, [{ string: '王安石', tag: 'persName' }], 'ignore');

    expect(await applyProjectionSuggestion(doc, suggestion!)).toBe(1);

    const persName = doc.getElementsByTagName('persName')[0]!;
    expect(persName.textContent).toBe('王安石');
    expect(persName.getElementsByTagName('pb')).toHaveLength(1);
  });

  it('applies inside corr with sic preserved (choice acceptance case)', async () => {
    const doc = parse(
      TEI_WRAP('<p><choice><sic>王尭</sic><corr>王<lb/>堯</corr></choice></p>'),
    );
    const [suggestion] = dictionaryTagProjection(doc, [{ string: '王堯', tag: 'persName' }], 'ignore');

    expect(await applyProjectionSuggestion(doc, suggestion!)).toBe(1);

    const corr = doc.getElementsByTagName('corr')[0]!;
    const sic = doc.getElementsByTagName('sic')[0]!;
    expect(sic.textContent).toBe('王尭');
    expect(corr.getElementsByTagName('persName')[0]!.textContent).toBe('王堯');
    expect(corr.getElementsByTagName('lb')).toHaveLength(1);
  });

  it('blocks schema-invalid projection insertions', async () => {
    const doc = parse(TEI_WRAP('<p>王<pb/>安石</p>'));
    const [suggestion] = dictionaryTagProjection(doc, [{ string: '王安石', tag: 'persName' }], 'ignore');

    const { results } = await applySuggestions(doc, [suggestion!], {
      policy: 'ignore',
      canContain: () => false,
    });
    expect(results[0]!.outcome).toBe('schema-blocked');
  });
});
