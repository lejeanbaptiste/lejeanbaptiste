import { buildDocIndex, collectTextNodes } from './anchor';
import { findTeiBodyRoot } from './dateTeiHelpers';
import { normalizeDomText } from './normalize';
import {
  buildProjectionIndex,
  infrastructureInProjectionRange,
} from './projectionIndex';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const TEI_WRAP = (body: string) =>
  `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>${body}</body></text></TEI>`;

describe('buildProjectionIndex', () => {
  it('bridges empty lb so split text reunites in projection', () => {
    const doc = parse(TEI_WRAP('<p>《般舟三<lb n="0324b25"/>昧》</p>'));
    const body = findTeiBodyRoot(doc);
    const index = buildProjectionIndex(body, 'ignore');

    expect(index.text).toContain('般舟三昧');
    expect(index.text).toBe('《般舟三昧》');
    expect(index.infrastructure).toHaveLength(1);
    expect(index.infrastructure[0]!.tag).toBe('lb');
    expect(index.infrastructure[0]!.afterOffset).toBe(index.text.indexOf('昧'));
    expect(infrastructureInProjectionRange(index, 0, index.text.length)).toHaveLength(1);
  });

  it('bridges empty pb like lb', () => {
    const doc = parse(TEI_WRAP('<p>王<pb n="0324b26"/>安石</p>'));
    const body = findTeiBodyRoot(doc);
    const index = buildProjectionIndex(body, 'ignore');

    expect(index.text).toBe('王安石');
    expect(index.infrastructure[0]!.tag).toBe('pb');
  });

  it('bridges lb and pb in one span', () => {
    const doc = parse(TEI_WRAP('<p>王<lb/>安<pb n="1"/>石</p>'));
    const index = buildProjectionIndex(findTeiBodyRoot(doc), 'ignore');

    expect(index.text).toBe('王安石');
    expect(index.infrastructure.map((m) => m.tag)).toEqual(['lb', 'pb']);
  });

  it('uses corr-only text inside choice (sic excluded)', () => {
    const doc = parse(
      TEI_WRAP('<p><choice><sic>王尭</sic><corr>王堯</corr></choice></p>'),
    );
    const index = buildProjectionIndex(findTeiBodyRoot(doc), 'ignore');

    expect(index.text).toBe('王堯');
    expect(index.text).not.toContain('尭');
    expect(index.points).toHaveLength(2);
  });

  it('still includes text inside an existing persName', () => {
    const doc = parse(TEI_WRAP('<p>見<persName>王安石</persName>。</p>'));
    const index = buildProjectionIndex(findTeiBodyRoot(doc), 'ignore');

    expect(index.text).toBe('見王安石。');
  });

  it('excludes teiHeader and date text', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0">
        <teiHeader><fileDesc><titleStmt><title>Secret</title></titleStmt></fileDesc></teiHeader>
        <text><body><p>正文<date when="0600">開皇</date>。</p></body></text>
      </TEI>`,
    );
    const index = buildProjectionIndex(doc.documentElement!, 'ignore');

    expect(index.text).toBe('正文。');
    expect(index.text).not.toContain('Secret');
    expect(index.text).not.toContain('開皇');
  });

  it('matches buildDocIndex text on plain body without infrastructure', () => {
    const doc = parse(TEI_WRAP('<p>見王安石訪鄭玄。</p>'));
    const body = findTeiBodyRoot(doc);
    const projection = buildProjectionIndex(body, 'ignore');
    const docIndex = buildDocIndex(body, 'ignore');

    expect(projection.text).toBe(docIndex.text);
    expect(projection.points).toHaveLength(projection.text.length);
  });

  it('maps each projection character back to a text node offset', () => {
    const doc = parse(TEI_WRAP('<p>《般舟三<lb/>昧》</p>'));
    const index = buildProjectionIndex(findTeiBodyRoot(doc), 'ignore');
    const surface = '般舟三昧';
    const at = index.text.indexOf(surface);
    expect(at).toBeGreaterThanOrEqual(0);

    const first = index.points[at]!;
    const last = index.points[at + surface.length - 1]!;
    expect(first.node).not.toBe(last.node);
    expect(first.node.data).toContain('般舟三');
    expect(last.node.data).toContain('昧');
  });

  it('ignores non-empty anchor elements (text preserved, not bridged)', () => {
    const doc = parse(TEI_WRAP('<p>甲<anchor xml:id="a1"/>乙</p>'));
    const index = buildProjectionIndex(findTeiBodyRoot(doc), 'ignore');

    expect(index.text).toBe('甲乙');
    expect(index.infrastructure).toHaveLength(1);
  });

  it('does not treat persName text nodes as infrastructure', () => {
    const doc = parse(TEI_WRAP('<p>甲<persName key="p1">乙</persName>丙</p>'));
    const index = buildProjectionIndex(findTeiBodyRoot(doc), 'ignore');

    expect(index.text).toBe('甲乙丙');
    expect(index.infrastructure).toHaveLength(0);
  });

  it('accepts a Document root like buildDocIndex', () => {
    const doc = parse(TEI_WRAP('<p>見王安石訪鄭玄。</p>'));
    const body = findTeiBodyRoot(doc);
    const fromDoc = buildProjectionIndex(doc, 'ignore');
    const fromBody = buildProjectionIndex(body, 'ignore');

    expect(fromDoc.text).toBe(fromBody.text);
    expect(fromDoc.text).toContain('王安石');
  });

  it('aligns with taggable nodes for plain paragraphs (minus header/date skips)', () => {
    const doc = parse(TEI_WRAP('<p>Alpha Beta</p>'));
    const body = findTeiBodyRoot(doc);
    const projection = buildProjectionIndex(body, 'collapse');
    const taggableNodes = collectTextNodes(body, 'collapse').filter(
      ({ node }) => !node.parentElement?.closest('date'),
    );
    const joined = taggableNodes.map(({ search }) => search.text).join('');

    expect(projection.text).toBe(joined);
  });
});
