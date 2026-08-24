import { applyNobleTitleSpanToEditor, liveSegmentsFromRange } from './nobleTitleSpanEditorApply';
import { buildNobleTitleVocabulary } from './nobleTitleSpanParser';
import type Writer from '../js/Writer';
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

/**
 * A minimal fake `Writer` standing in for TinyMCE + `tagger.addStructureTag`.
 * `addStructureTag`'s real implementation is jQuery/TinyMCE-specific (see
 * tagger.ts) and isn't exercised here; this fake reproduces just its
 * observable contract — wrap a range or a set of existing elements in a new
 * `<span _tag="…">` with a fresh id — so this test can verify
 * `applyNobleTitleSpanToEditor`'s own orchestration (call order, which ids
 * get threaded into which wrap) against a real DOM.
 */
function makeFakeWriter(doc: Document): Writer {
  let idCounter = 0;
  const nextId = () => `dom_${idCounter++}`;
  let currentRange: Range | null = null;

  const addStructureTag = ({
    action,
    attributes,
    bookmark,
    tagName,
  }: {
    action: string;
    attributes: Record<string, string>;
    bookmark: { __fakeRange?: Range; tagId?: string | string[] };
    tagName: string;
  }): Element => {
    const el = doc.createElement('span');
    el.setAttribute('_tag', tagName);
    el.id = nextId();
    for (const [key, value] of Object.entries(attributes ?? {})) el.setAttribute(key, value);

    if (action === 'add') {
      const range = bookmark.__fakeRange!;
      range.surroundContents(el);
      return el;
    }

    // action === 'around'
    const ids = Array.isArray(bookmark.tagId) ? bookmark.tagId : [bookmark.tagId as string];
    const elements = ids.map((id) => doc.getElementById(id)!);
    elements[0]!.parentNode!.insertBefore(el, elements[0]!);
    for (const child of elements) el.appendChild(child);
    return el;
  };

  return {
    editor: {
      selection: {
        setRng: (range: Range) => {
          currentRange = range;
        },
        getBookmark: (_type: number) => ({ __fakeRange: currentRange }),
      },
    },
    tagger: { addStructureTag },
  } as unknown as Writer;
}

// The live TinyMCE body is plain HTML (no XML namespaces at all — every
// structural/entity tag is a bare `<span _tag="…">`), unlike
// `nobleTitleSpanApply.ts`'s namespaced-XML target, so these tests build a
// plain HTML fragment rather than reusing that other test file's XML setup.
const makeSpan = (inner: string): Document => {
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = `<p>${inner}</p>`;
  return doc;
};

/** Selects the full text content of `<p>` as a Range. */
const rangeOverWholeParagraph = (doc: Document): Range => {
  const p = doc.querySelector('p')!;
  const range = doc.createRange();
  range.selectNodeContents(p);
  return range;
};

const serialize = (doc: Document) =>
  doc.querySelector('p')!.outerHTML.replace(/ id="dom_\d+"/g, ''); // ids are incidental to this test's assertions

describe('liveSegmentsFromRange', () => {
  it('treats a selection fully inside one text node as a single segment', () => {
    const doc = makeSpan('魏武帝');
    const range = rangeOverWholeParagraph(doc);
    const segments = liveSegmentsFromRange(range);
    expect(segments).toHaveLength(1);
    expect(segments![0]).toMatchObject({ kind: 'text', text: '魏武帝', nodeTextStart: 0 });
  });

  it('splits a selection spanning an existing tagged element and plain text', () => {
    const doc = makeSpan('<span _tag="placeName" id="p1">鄱陽</span>王');
    const range = rangeOverWholeParagraph(doc);
    const segments = liveSegmentsFromRange(range);
    expect(segments).toEqual([
      expect.objectContaining({ kind: 'element', localName: 'placeName', text: '鄱陽' }),
      expect.objectContaining({ kind: 'text', text: '王' }),
    ]);
  });
});

describe('applyNobleTitleSpanToEditor', () => {
  it('tags a plain-text selection into nested components', () => {
    const doc = makeSpan('魏武帝');
    const writer = makeFakeWriter(doc);
    const range = rangeOverWholeParagraph(doc);

    const result = applyNobleTitleSpanToEditor(writer, range, vocabulary);
    expect(result.applied).toBe(true);
    // "魏武帝" alone has no room for a distinct dynasty prefix (魏 already
    // serves as the fief), so — matching nobleTitleSpanParser's own test
    // suite — this parses as fief+posthumous+rank with no dynasty slot.
    expect(serialize(doc)).toBe(
      '<p><span _tag="nobleTitle">' +
        '<span _tag="placeName">魏</span>' +
        '<span _tag="persName" type="posthumous">武</span>' +
        '<span _tag="roleName">帝</span>' +
        '</span></p>',
    );
  });

  it('sets @dynasty when the dynasty is distinct from the fief', () => {
    const doc = makeSpan('魏博陵文簡王');
    const writer = makeFakeWriter(doc);
    const range = rangeOverWholeParagraph(doc);

    const result = applyNobleTitleSpanToEditor(writer, range, vocabulary);
    expect(result.applied).toBe(true);
    // The dynasty text is never itself tagged — no legal home for it as a
    // <nobleTitle> child — so it's left as plain text ahead of the tag,
    // with @dynasty carrying it structurally.
    expect(serialize(doc)).toBe(
      '<p>魏<span _tag="nobleTitle" dynasty="魏">' +
        '<span _tag="placeName">博陵</span>' +
        '<span _tag="persName" type="posthumous">文簡</span>' +
        '<span _tag="roleName">王</span>' +
        '</span></p>',
    );
  });

  it('reuses an existing tagged fief instead of wrapping it again', () => {
    const doc = makeSpan('<span _tag="placeName" id="p1" ref="chgis:1">鄱陽</span>王');
    const writer = makeFakeWriter(doc);
    const range = rangeOverWholeParagraph(doc);

    const result = applyNobleTitleSpanToEditor(writer, range, vocabulary);
    expect(result.applied).toBe(true);
    // The original placeName element (with its ref) is still there, just now nested.
    const placeName = doc.querySelector('[_tag="placeName"]')!;
    expect(placeName.getAttribute('ref')).toBe('chgis:1');
    expect(placeName.parentElement!.getAttribute('_tag')).toBe('nobleTitle');
    expect(doc.querySelectorAll('[_tag="placeName"]')).toHaveLength(1);
  });

  it('wraps a title plus trailing name in a pending personWrapper', () => {
    const doc = makeSpan('鄱陽王範');
    const writer = makeFakeWriter(doc);
    const range = rangeOverWholeParagraph(doc);

    const result = applyNobleTitleSpanToEditor(writer, range, vocabulary);
    expect(result.applied).toBe(true);
    expect(serialize(doc)).toBe(
      '<p><span _tag="name" type="personWrapper" cert="unknown">' +
        '<span _tag="nobleTitle">' +
        '<span _tag="placeName">鄱陽</span>' +
        '<span _tag="roleName">王</span>' +
        '</span>' +
        '<span _tag="persName">範</span>' +
        '</span></p>',
    );
  });

  it('does not touch the document when no rank is recognised', () => {
    const doc = makeSpan('曹操');
    const writer = makeFakeWriter(doc);
    const range = rangeOverWholeParagraph(doc);
    const before = serialize(doc);

    const result = applyNobleTitleSpanToEditor(writer, range, vocabulary);
    expect(result.applied).toBe(false);
    expect(serialize(doc)).toBe(before);
  });
});
