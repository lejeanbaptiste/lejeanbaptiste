import {
  buildDocIndex,
  createAnchor,
  locateAnchorInIndex,
  locateOccurrenceInIndex,
} from './anchor';
import { AutoTaggingSession, type WriterLike } from './integration';
import type { MentionInstance } from './mentions';
import { normalizeDomText } from './normalize';

const XML = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p>世祖初立。</p>
<p>又見世祖。</p>
<p>世祖崩。</p>
</body></text></TEI>`;

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

/** Anchor for the Nth occurrence of `surface` in the XML document. */
const anchorFor = (surface: string, occurrence: number) => {
  const doc = parse(XML);
  const index = buildDocIndex(doc.documentElement!, 'ignore');
  const flat: { node: Text; at: number }[] = [];
  for (const { node, search } of index.nodes) {
    for (
      let at = search.text.indexOf(surface);
      at !== -1;
      at = search.text.indexOf(surface, at + 1)
    )
      flat.push({ node, at: search.map[at]! });
  }
  const hit = flat[occurrence - 1]!;
  return createAnchor(
    'current',
    doc.documentElement!,
    hit.node,
    hit.at,
    hit.at + surface.length,
    'ignore',
    index,
  );
};

const mention = (surface: string, occurrence: number): MentionInstance => ({
  documentId: 'current',
  tag: 'persName',
  surface,
  element: parse(XML).createElement('persName'),
  anchor: anchorFor(surface, occurrence),
  hasKey: false,
  isUnresolved: false,
});

/** Fake editor over a real (jsdom) body element, as TinyMCE presents one. */
const makeEditorWriter = (html: string) => {
  const body = document.createElement('div');
  body.innerHTML = html;
  document.body.appendChild(body);
  const handlers: (() => void)[] = [];
  let range: Range | null = null;
  const writer = {
    converter: { getDocumentContent: async () => XML },
    loadDocumentXML: () => undefined,
    editor: {
      getBody: () => body,
      getDoc: () => document,
      getWin: () => window,
      selection: {
        setRng: (value: Range) => {
          range = value;
        },
        scrollIntoView: () => undefined,
      },
      on: (_events: string, handler: () => void) => handlers.push(handler),
    },
  } as unknown as WriterLike;
  return {
    writer,
    body,
    selected: () => range?.toString() ?? null,
    /** Replace the content the way a document reload does: same body element. */
    reload: (next: string) => {
      body.innerHTML = next;
      for (const handler of handlers) handler();
    },
    /** Same swap, but with no editor event to announce it. */
    reloadSilently: (next: string) => {
      body.innerHTML = next;
    },
  };
};

const BODY_HTML = '<p _tag="p">世祖初立。</p><p _tag="p">又見世祖。</p><p _tag="p">世祖崩。</p>';

describe('editor focus jumps', () => {
  it('selects and highlights the requested occurrence, not the first', () => {
    const { writer, body, selected } = makeEditorWriter(BODY_HTML);
    const session = new AutoTaggingSession(writer, 'ignore', null);

    expect(session.focusMention(mention('世祖', 2))).toBe(true);
    expect(selected()).toBe('世祖');
    const highlight = body.querySelector('[data-lw-autotag-focus]');
    expect(highlight?.textContent).toBe('世祖');
    expect(highlight?.closest('p')?.textContent).toBe('又見世祖。');
  });

  it('moves the highlight rather than leaving a trail behind', () => {
    const { writer, body } = makeEditorWriter(BODY_HTML);
    const session = new AutoTaggingSession(writer, 'ignore', null);

    session.focusMention(mention('世祖', 1));
    session.focusMention(mention('世祖', 3));

    const highlights = body.querySelectorAll('[data-lw-autotag-focus]');
    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.closest('p')?.textContent).toBe('世祖崩。');
  });

  it('still jumps after the editor content is replaced under the same body', () => {
    const { writer, selected, reload, body } = makeEditorWriter(BODY_HTML);
    const session = new AutoTaggingSession(writer, 'ignore', null);

    expect(session.focusMention(mention('世祖', 2))).toBe(true);
    reload(BODY_HTML);

    expect(session.focusMention(mention('世祖', 2))).toBe(true);
    expect(selected()).toBe('世祖');
    expect(body.querySelector('[data-lw-autotag-focus]')?.closest('p')?.textContent).toBe(
      '又見世祖。',
    );
  });

  it('rebuilds its index when content is replaced without an editor event', () => {
    const { writer, selected, reloadSilently, body } = makeEditorWriter(BODY_HTML);
    const session = new AutoTaggingSession(writer, 'ignore', null);

    expect(session.focusMention(mention('世祖', 2))).toBe(true);
    reloadSilently(BODY_HTML);

    expect(session.focusMention(mention('世祖', 2))).toBe(true);
    expect(selected()).toBe('世祖');
    const highlight = body.querySelector('[data-lw-autotag-focus]');
    expect(highlight?.closest('p')?.textContent).toBe('又見世祖。');
    expect(body.contains(highlight)).toBe(true);
  });

  it('jumps through zero-width characters TinyMCE leaves in the body', () => {
    // A zero-width space inside the first mention: the editor copy must still
    // line up with the occurrence counted in the XML.
    const { writer, body, selected } = makeEditorWriter(
      '<p _tag="p">世\u200B祖初立。</p><p _tag="p">又見世祖。</p><p _tag="p">世祖崩。</p>',
    );
    const session = new AutoTaggingSession(writer, 'ignore', null);

    expect(session.focusMention(mention('世祖', 2))).toBe(true);
    expect(selected()).toBe('世祖');
    expect(body.querySelector('[data-lw-autotag-focus]')?.closest('p')?.textContent).toContain(
      '又見世祖',
    );
  });

  it('clears the highlight when the panel releases it', () => {
    const { writer, body } = makeEditorWriter(BODY_HTML);
    const session = new AutoTaggingSession(writer, 'ignore', null);

    session.focusMention(mention('世祖', 1));
    session.clearFocusHighlight();

    expect(body.querySelector('[data-lw-autotag-focus]')).toBeNull();
    expect(body.textContent).toBe('世祖初立。又見世祖。世祖崩。');
  });
});

describe('editor focus jumps with the CSS Custom Highlight API', () => {
  interface FakeHighlightWindow {
    Highlight?: unknown;
    CSS?: { highlights?: Map<string, unknown> };
  }

  let saved: { Highlight?: unknown; highlights?: Map<string, unknown> } = {};
  let registry: Map<string, unknown>;

  beforeEach(() => {
    const win = window as unknown as FakeHighlightWindow;
    registry = new Map();
    saved = { Highlight: win.Highlight, highlights: win.CSS?.highlights };
    win.Highlight = class {
      constructor(readonly range: Range) {}
    };
    win.CSS = { ...(win.CSS ?? {}), highlights: registry };
  });

  afterEach(() => {
    const win = window as unknown as FakeHighlightWindow;
    win.Highlight = saved.Highlight;
    if (win.CSS) win.CSS.highlights = saved.highlights;
  });

  const highlightedText = () => {
    const entry = registry.get('lw-autotag-focus') as { range: Range } | undefined;
    return entry?.range.toString() ?? null;
  };

  const highlightedParagraph = () => {
    const entry = registry.get('lw-autotag-focus') as { range: Range } | undefined;
    const node = entry?.range.startContainer;
    return (node instanceof Text ? node.parentElement : (node as Element | null))?.closest('p')
      ?.textContent;
  };

  it('paints the mention without touching the document text', () => {
    const { writer, body } = makeEditorWriter(BODY_HTML);
    const session = new AutoTaggingSession(writer, 'ignore', null);

    expect(session.focusMention(mention('世祖', 2))).toBe(true);
    expect(highlightedText()).toBe('世祖');
    expect(highlightedParagraph()).toBe('又見世祖。');
    expect(body.querySelector('[data-lw-autotag-focus]')).toBeNull();
    expect(body.innerHTML).toBe(BODY_HTML);
  });

  it('rebuilds its index when content is replaced without an editor event', () => {
    const { writer, body, reloadSilently } = makeEditorWriter(BODY_HTML);
    const session = new AutoTaggingSession(writer, 'ignore', null);

    expect(session.focusMention(mention('世祖', 2))).toBe(true);
    reloadSilently(BODY_HTML);

    expect(session.focusMention(mention('世祖', 2))).toBe(true);
    expect(highlightedParagraph()).toBe('又見世祖。');
    // A highlight over text detached by the reload paints nothing on screen.
    const entry = registry.get('lw-autotag-focus') as { range: Range } | undefined;
    expect(body.contains(entry!.range.startContainer)).toBe(true);
  });

  it('drops the painted highlight when the panel releases it', () => {
    const { writer } = makeEditorWriter(BODY_HTML);
    const session = new AutoTaggingSession(writer, 'ignore', null);

    session.focusMention(mention('世祖', 1));
    session.clearFocusHighlight();

    expect(registry.size).toBe(0);
  });
});

describe('search text over editor-only characters', () => {
  it('matches across zero-width marks left in the editor text', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p>世\u200B祖初立。</p><p>又見世祖。</p>';
    const index = buildDocIndex(editor, 'ignore');

    const first = locateOccurrenceInIndex(index, '世祖', 1);
    expect(first?.node.data).toContain('初立');
    // The offsets still address the raw text, marks included.
    expect(first?.node.data.slice(first.start, first.end)).toBe('世\u200B祖');
    expect(locateOccurrenceInIndex(index, '世祖', 2)?.node.data).toContain('又見');
  });
});

describe('locateAnchorInIndex', () => {
  it('falls back to the context match when occurrence counts have drifted', () => {
    const anchor = anchorFor('世祖', 2);
    // Editor copy carries one extra, earlier occurrence: the recorded ordinal
    // now points at the wrong mention, the stored context at the right one.
    const editor = document.createElement('div');
    editor.innerHTML = '<p>世祖前記。</p><p>世祖初立。</p><p>又見世祖。</p><p>世祖崩。</p>';
    const index = buildDocIndex(editor, 'ignore');

    const located = locateAnchorInIndex(index, anchor);
    expect(located?.node.data).toContain('又見世祖');
  });
});
