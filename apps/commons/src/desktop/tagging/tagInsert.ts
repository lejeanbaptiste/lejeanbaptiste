import type { ApplyTagResult } from './tagCommand';
import { applyInsertTag } from './tagCommand';
import { getEditorTagContext, type EditorTagContext } from './tagSuggestions';
import { DEFAULT_INSERT_TAG, DEFAULT_LINE_BREAK_TAG } from './keybindings';

const getWriter = () => window.writer;

const isInlineStructuralParent = (element: Element | null): boolean => {
  if (!element?.hasAttribute('_tag')) return false;
  if (element.getAttribute('_entity') === 'true') return false;
  const tagName = element.tagName.toLowerCase();
  return tagName === 'span' || element.getAttribute('data-mce-type') === 'inline';
};

const isStructuralTagParent = (element: Element | null): boolean => {
  if (!element?.hasAttribute('_tag')) return false;
  return element.getAttribute('_entity') !== 'true';
};

const getTextParentAtCaret = (ctx: EditorTagContext): Element | null => {
  if (!ctx.rng.collapsed || ctx.rng.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const parent = ctx.rng.startContainer.parentNode;
  return parent?.nodeType === Node.ELEMENT_NODE ? (parent as Element) : null;
};

export const findParagraphAncestor = (node: Node, editorBody: Element): Element | null => {
  let current: Node | null = node;
  while (current && current !== editorBody) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      if (el.getAttribute('_tag') === DEFAULT_INSERT_TAG) return el;
    }
    current = current.parentNode;
  }
  return null;
};

/** Split at caret when inserting the same tag (e.g. p inside p → two paragraphs). */
export const shouldSplitSameTagAtCaret = (
  parentTag: string | null,
  tagName: string,
  collapsed: boolean,
  inTextNode: boolean,
): boolean => collapsed && inTextNode && Boolean(parentTag) && parentTag === tagName;

const runSplitAtCaret = (): boolean => {
  const writer = getWriter();
  if (!writer?.editor || !writer.tagger) return false;
  writer.tagger.splitTag();
  return true;
};

const ensureCollapsedTextRange = (): boolean => {
  const writer = getWriter();
  const editor = writer?.editor;
  if (!editor) return false;

  const rng = editor.selection.getRng(true);
  if (!rng.collapsed) return false;
  if (rng.startContainer.nodeType === Node.TEXT_NODE) return true;

  if (rng.startContainer.nodeType !== Node.ELEMENT_NODE) return false;

  const element = rng.startContainer as Element;
  const doc = editor.getDoc();
  const offset = rng.startOffset;

  if (offset < element.childNodes.length) {
    const child = element.childNodes[offset];
    if (child?.nodeType === Node.TEXT_NODE) {
      const next = doc.createRange();
      next.setStart(child, 0);
      next.collapse(true);
      editor.selection.setRng(next);
      return true;
    }
  }

  if (offset > 0) {
    const prev = element.childNodes[offset - 1];
    if (prev?.nodeType === Node.TEXT_NODE) {
      const next = doc.createRange();
      const len = prev.textContent?.length ?? 0;
      next.setStart(prev, len);
      next.collapse(true);
      editor.selection.setRng(next);
      return true;
    }
  }

  const text = doc.createTextNode('');
  if (offset < element.childNodes.length) {
    element.insertBefore(text, element.childNodes[offset]);
  } else {
    element.appendChild(text);
  }
  const next = doc.createRange();
  next.setStart(text, 0);
  next.collapse(true);
  editor.selection.setRng(next);
  return true;
};

/**
 * True when a collapsed range sits at the very end of `element`'s content, including inside
 * nested inline tags (e.g. an entity right before the closing tag) — walks up from the range
 * position checking that nothing follows at each level.
 */
export const isAtEndOfElement = (range: Range, element: Element): boolean => {
  if (!range.collapsed) return false;
  let container: Node = range.startContainer;
  let offset = range.startOffset;

  while (true) {
    const length =
      container.nodeType === Node.TEXT_NODE
        ? (container as Text).length
        : container.childNodes.length;
    if (offset < length) return false;
    if (container === element) return true;

    const parent: Node | null = container.parentNode;
    if (!parent) return false;
    offset = Array.prototype.indexOf.call(parent.childNodes, container) + 1;
    container = parent;
  }
};

/**
 * Copies a paragraph's attributes onto a new split-off element, excluding every form the
 * schema id takes in the editor's tagged DOM: the literal `xml:id`/`id` attributes AND the
 * copy embedded in the JSON-encoded `_attributes` blob (which is what the tagger, the
 * serializer, and the translation pane actually read — leaving it there means the new
 * paragraph inherits the original's identity until the next save repairs it).
 */
export const copyAttributesWithoutSchemaId = (from: Element, to: Element) => {
  const schemaId = getWriter()?.schemaManager?.getIdName?.() ?? 'xml:id';

  for (let i = 0; i < from.attributes.length; i++) {
    const attr = from.attributes[i];
    if (!attr || attr.name === 'id' || attr.name === 'xml:id' || attr.name === schemaId) continue;

    if (attr.name === '_attributes') {
      try {
        const parsed = JSON.parse(attr.value) as Record<string, unknown>;
        delete parsed['xml:id'];
        delete parsed.id;
        delete parsed[schemaId];
        to.setAttribute('_attributes', JSON.stringify(parsed));
      } catch {
        // unparseable blob — safer to drop it than to duplicate an identity
      }
      continue;
    }

    to.setAttribute(attr.name, attr.value);
  }
};

/**
 * Insert a fresh empty sibling paragraph after `paragraph` and move the cursor into it.
 * Used at the very end of a paragraph instead of extracting an (empty) split — avoids
 * relying on Range extraction exactly at the boundary, and since the new paragraph is
 * genuinely new content (not part of the original), it gets a fresh xml:id rather than a
 * copy of the original's, so no duplicate-id reindex is ever needed for this case.
 */
const insertEmptySiblingParagraph = (writer: NonNullable<ReturnType<typeof getWriter>>, paragraph: Element): ApplyTagResult => {
  const doc = writer.editor!.getDoc();

  writer.editor!.undoManager.transact(() => {
    const newPara = doc.createElement(paragraph.nodeName);
    copyAttributesWithoutSchemaId(paragraph, newPara);
    newPara.setAttribute('id', writer.getUniqueId('dom_'));

    const placeholder = doc.createTextNode('﻿');
    newPara.appendChild(placeholder);
    paragraph.parentNode?.insertBefore(newPara, paragraph.nextSibling);

    const cursorRng = doc.createRange();
    cursorRng.setStart(placeholder, 0);
    cursorRng.collapse(true);
    writer.editor!.selection.setRng(cursorRng);
  });

  writer.event('contentChanged').publish();
  return { applied: true, tagName: DEFAULT_INSERT_TAG };
};

/** Split paragraph at caret using Range extraction, preserving inline elements as children. */
export const splitParagraphAtCaret = (): ApplyTagResult => {
  const writer = getWriter();
  if (!writer?.editor || !writer.tagger) return { applied: false };

  if (!ensureCollapsedTextRange()) {
    return { applied: false, error: 'Place the caret in text to split the paragraph.' };
  }

  const body = writer.editor.getBody();
  const rng0 = writer.editor.selection.getRng(true);
  const paragraph = findParagraphAncestor(rng0.startContainer, body);
  if (!paragraph) {
    return { applied: false, error: 'Caret is not inside a paragraph.' };
  }

  if (isAtEndOfElement(rng0, paragraph)) {
    return insertEmptySiblingParagraph(writer, paragraph);
  }

  const doc = writer.editor.getDoc();

  writer.editor.undoManager.transact(() => {
    const caretRng = writer.editor!.selection.getRng(true);

    // Extract everything from the caret to the end of the paragraph into a new <p>
    const afterRng = doc.createRange();
    afterRng.setStart(caretRng.startContainer, caretRng.startOffset);
    afterRng.setEnd(paragraph, paragraph.childNodes.length);
    const afterContent = afterRng.extractContents();

    // Build the new paragraph with the same _tag attributes but a fresh identity — the
    // first half keeps the original xml:id (and its translation); the split-off half is
    // new content and starts without one.
    const newPara = doc.createElement(paragraph.nodeName);
    copyAttributesWithoutSchemaId(paragraph, newPara);
    newPara.setAttribute('id', writer.getUniqueId('dom_'));

    // Give any extracted element children fresh ids so there are no duplicate ids
    const assignIds = (fragment: Node) => {
      fragment.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          (child as Element).setAttribute('id', writer.getUniqueId('dom_'));
          assignIds(child);
        }
      });
    };
    assignIds(afterContent);

    newPara.appendChild(afterContent);
    paragraph.parentNode?.insertBefore(newPara, paragraph.nextSibling);

    // Place cursor at start of the new paragraph's first text node
    const firstText = (function findFirstText(n: Node): Text | null {
      if (n.nodeType === Node.TEXT_NODE) return n as Text;
      for (let i = 0; i < n.childNodes.length; i++) {
        const found = findFirstText(n.childNodes[i]!);
        if (found) return found;
      }
      return null;
    })(newPara);

    const cursorRng = doc.createRange();
    if (firstText) {
      cursorRng.setStart(firstText, 0);
    } else {
      const placeholder = doc.createTextNode('﻿');
      newPara.appendChild(placeholder);
      cursorRng.setStart(placeholder, 0);
    }
    cursorRng.collapse(true);
    writer.editor!.selection.setRng(cursorRng);
  });

  writer.event('contentChanged').publish();
  return { applied: true, tagName: DEFAULT_INSERT_TAG };
};

export type SplitAtCaretResult =
  | { kind: 'applied'; result: ApplyTagResult }
  | { kind: 'continued' }
  | { kind: 'none' };

export const trySplitAtCaretForInsert = (tagName: string): SplitAtCaretResult => {
  const ctx = getEditorTagContext();
  if (!ctx) return { kind: 'none' };

  const writer = getWriter();
  const body = writer?.editor?.getBody();
  if (!body) return { kind: 'none' };

  if (
    tagName === DEFAULT_INSERT_TAG &&
    ctx.rng.collapsed &&
    findParagraphAncestor(ctx.rng.startContainer, body)
  ) {
    const result = splitParagraphAtCaret();
    if (result.applied) return { kind: 'applied', result };
    return { kind: 'none' };
  }

  const parent = getTextParentAtCaret(ctx);
  if (!isStructuralTagParent(parent)) return { kind: 'none' };

  const parentTag = parent!.getAttribute('_tag');
  const inTextNode = ctx.rng.startContainer.nodeType === Node.TEXT_NODE;

  if (shouldSplitSameTagAtCaret(parentTag, tagName, ctx.rng.collapsed, inTextNode)) {
    writer!.editor!.selection.setRng(ctx.rng);
    writer!.editor!.undoManager.transact(() => {
      runSplitAtCaret();
    });
    writer!.event('contentChanged').publish();
    return { kind: 'applied', result: { applied: true, tagName } };
  }

  const isBlockOrBreak =
    tagName === DEFAULT_INSERT_TAG || tagName === DEFAULT_LINE_BREAK_TAG;
  if (isInlineStructuralParent(parent) && isBlockOrBreak) {
    writer!.editor!.selection.setRng(ctx.rng);
    writer!.editor!.undoManager.transact(() => {
      runSplitAtCaret();
    });
    return { kind: 'continued' };
  }

  return { kind: 'none' };
};

export const insertTagWithSplit = (tagName: string): ApplyTagResult => {
  const splitAttempt = trySplitAtCaretForInsert(tagName);
  if (splitAttempt.kind === 'applied') return splitAttempt.result;
  if (splitAttempt.kind === 'continued') {
    return { applied: false };
  }
  return { applied: false };
};

export const insertLineBreak = async (): Promise<ApplyTagResult> => {
  const writer = getWriter();
  const ctx = getEditorTagContext();
  if (!writer?.editor || !writer.tagger || !ctx) return { applied: false, error: 'Editor not ready' };

  const lbResult = await applyInsertTag(DEFAULT_LINE_BREAK_TAG);
  if (lbResult.applied) return lbResult;

  const splitResult = insertTagWithSplit(DEFAULT_LINE_BREAK_TAG);
  if (splitResult.applied) return splitResult;

  if (isInlineStructuralParent(ctx.tagElement)) {
    writer.editor.undoManager.transact(() => {
      writer.tagger.splitTag();
    });
    writer.event('contentChanged').publish();
    return { applied: true, tagName: DEFAULT_LINE_BREAK_TAG };
  }

  return { applied: false, error: 'Cannot insert line break here.' };
};
