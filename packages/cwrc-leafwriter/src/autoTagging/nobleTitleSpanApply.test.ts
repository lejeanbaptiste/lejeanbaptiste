import { applyNobleTitleSpan } from './nobleTitleSpanApply';
import { buildNobleTitleVocabulary } from './nobleTitleSpanParser';
import { validatePersonWrapper } from './personWrapperValidation';
import type { AuthorityCandidate } from './authority';

const packRow = (
  fief: string,
  roleName: string,
  posthumousName?: string,
  dynasty?: string,
): AuthorityCandidate => ({
  source: 'norbert-direct',
  authorityId: `t:${fief}${roleName}`,
  kind: 'person',
  primaryName: 'x',
  searchStrings: ['x'],
  metadata: { isNobleTitle: true, dynasty, nobleTitle: { fief, roleName, posthumousName } },
});

const vocabulary = buildNobleTitleVocabulary([
  packRow('魏', '帝', '武', '魏'),
  packRow('鄱陽', '王', undefined, '梁'),
  packRow('博陵', '王', '文簡', '魏'),
]);

const TEI = 'http://www.tei-c.org/ns/1.0';

const makeSpan = (inner: string) => {
  const doc = new DOMParser().parseFromString(`<p xmlns="${TEI}">${inner}</p>`, 'application/xml');
  return { doc, nodes: Array.from(doc.documentElement!.childNodes) };
};

const serialize = (doc: Document) =>
  new XMLSerializer()
    .serializeToString(doc.documentElement!)
    .replace(new RegExp(` xmlns="${TEI}"`, 'g'), '');

describe('applyNobleTitleSpan', () => {
  it('decomposes a plain-text span into nested components', () => {
    const { doc, nodes } = makeSpan('魏武帝');
    const result = applyNobleTitleSpan(doc, nodes, vocabulary);
    expect(result.applied).toBe(true);
    expect(serialize(doc)).toBe(
      '<p><nobleTitle><placeName>魏</placeName>' +
        '<persName type="posthumous">武</persName>' +
        '<roleName>帝</roleName></nobleTitle></p>',
    );
  });

  it('reuses a pre-tagged placeName and keeps its attributes', () => {
    const { doc, nodes } = makeSpan('<placeName ref="chgis:1234" cert="high">鄱陽</placeName>王');
    const result = applyNobleTitleSpan(doc, nodes, vocabulary);
    expect(result.applied).toBe(true);
    const placeName = doc.getElementsByTagName('placeName')[0]!;
    expect(placeName.getAttribute('ref')).toBe('chgis:1234');
    expect(placeName.getAttribute('cert')).toBe('high');
    expect(placeName.parentNode!.nodeName).toBe('nobleTitle');
    // Exactly one placeName — the original was moved, not duplicated.
    expect(doc.getElementsByTagName('placeName')).toHaveLength(1);
  });

  it('adds @type="posthumous" to an untyped persName already in the span', () => {
    const { doc, nodes } = makeSpan('魏<persName>武</persName>帝');
    expect(applyNobleTitleSpan(doc, nodes, vocabulary).applied).toBe(true);
    const persName = doc.getElementsByTagName('persName')[0]!;
    expect(persName.getAttribute('type')).toBe('posthumous');
    expect(persName.textContent).toBe('武');
  });

  it('refuses to overwrite a different, deliberate @type on a reused persName', () => {
    const { doc, nodes } = makeSpan('魏<persName type="temple">武</persName>帝');
    const before = serialize(doc);
    const result = applyNobleTitleSpan(doc, nodes, vocabulary);
    expect(result.applied).toBe(false);
    expect(result.conflicts.join(' ')).toMatch(/type="temple".*retag it before applying/);
    expect(serialize(doc)).toBe(before); // document untouched
  });

  it('wraps a title plus trailing name in a pending personWrapper', () => {
    const { doc, nodes } = makeSpan('鄱陽王範');
    const result = applyNobleTitleSpan(doc, nodes, vocabulary);
    expect(result.applied).toBe(true);
    expect(serialize(doc)).toBe(
      '<p><name type="personWrapper" cert="unknown">' +
        '<nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle>' +
        '<persName>範</persName></name></p>',
    );
  });

  it('produces a wrapper the existing validator accepts as pending', () => {
    const { doc, nodes } = makeSpan('鄱陽王範');
    const result = applyNobleTitleSpan(doc, nodes, vocabulary);
    const validation = validatePersonWrapper(result.element!);
    expect(validation.errors).toEqual([]);
    expect(validation.pending).toBe(1);
  });

  it('keeps the dynasty as @dynasty plus a <nationality> inside the wrapper', () => {
    const { doc, nodes } = makeSpan('魏博陵文簡王順');
    const result = applyNobleTitleSpan(doc, nodes, vocabulary);
    expect(result.applied).toBe(true);
    expect(doc.getElementsByTagName('nobleTitle')[0]!.getAttribute('dynasty')).toBe('魏');
    expect(doc.getElementsByTagName('nationality')[0]!.textContent).toBe('魏');
    expect(validatePersonWrapper(result.element!).errors).toEqual([]);
  });

  it('keeps the dynasty text as a sibling when there is no wrapper to hold it', () => {
    const { doc, nodes } = makeSpan('魏博陵文簡王');
    expect(applyNobleTitleSpan(doc, nodes, vocabulary).applied).toBe(true);
    // <nobleTitle> may not contain a dynasty child, so the text survives outside it.
    expect(serialize(doc)).toBe(
      '<p>魏<nobleTitle dynasty="魏"><placeName>博陵</placeName>' +
        '<persName type="posthumous">文簡</persName>' +
        '<roleName>王</roleName></nobleTitle></p>',
    );
    expect(doc.documentElement!.textContent).toBe('魏博陵文簡王'); // nothing lost
  });

  it('leaves the document untouched when no rank is recognised', () => {
    const { doc, nodes } = makeSpan('曹操');
    const before = serialize(doc);
    const result = applyNobleTitleSpan(doc, nodes, vocabulary);
    expect(result.applied).toBe(false);
    expect(serialize(doc)).toBe(before);
  });

  it('preserves surrounding siblings and inserts at the right position', () => {
    const { doc } = makeSpan('前魏武帝後');
    // Select only the middle text by splitting it into three nodes first.
    const textNode = doc.documentElement!.firstChild!;
    const middle = (textNode as Text).splitText(1);
    middle.splitText(3);
    const result = applyNobleTitleSpan(doc, [middle], vocabulary);
    expect(result.applied).toBe(true);
    expect(serialize(doc)).toBe(
      '<p>前<nobleTitle><placeName>魏</placeName>' +
        '<persName type="posthumous">武</persName>' +
        '<roleName>帝</roleName></nobleTitle>後</p>',
    );
  });

  it('refuses a selection spanning more than one parent', () => {
    const { doc } = makeSpan('<hi>魏</hi>武帝');
    const inner = doc.getElementsByTagName('hi')[0]!.firstChild!;
    const outer = doc.documentElement!.lastChild!;
    const result = applyNobleTitleSpan(doc, [inner, outer], vocabulary);
    expect(result.applied).toBe(false);
    expect(result.conflicts[0]).toMatch(/more than one parent/);
  });

  it('surfaces a swallowed-component warning while still applying', () => {
    const { doc, nodes } = makeSpan('<placeName>魏武</placeName>帝');
    const result = applyNobleTitleSpan(doc, nodes, vocabulary);
    expect(result.applied).toBe(true);
    expect(result.conflicts.join(' ')).toMatch(/may span more than the fief/);
    // The user's tag is honoured verbatim, not silently re-cut.
    expect(doc.getElementsByTagName('placeName')[0]!.textContent).toBe('魏武');
  });
});
