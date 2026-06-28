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

/** Split paragraph at caret; also splits any open inline tags at the caret first. */
export const splitParagraphAtCaret = (): ApplyTagResult => {
  const writer = getWriter();
  if (!writer?.editor || !writer.tagger) return { applied: false };

  if (!ensureCollapsedTextRange()) {
    return { applied: false, error: 'Place the caret in text to split the paragraph.' };
  }

  const body = writer.editor.getBody();
  const paragraph = findParagraphAncestor(writer.editor.selection.getRng(true).startContainer, body);
  if (!paragraph) {
    return { applied: false, error: 'Caret is not inside a paragraph.' };
  }

  writer.editor.undoManager.transact(() => {
    let safety = 24;
    while (safety-- > 0) {
      const rng = writer.editor!.selection.getRng(true);
      if (rng.startContainer.nodeType !== Node.TEXT_NODE) break;

      const parent = rng.startContainer.parentNode as Element | null;
      if (!parent?.hasAttribute('_tag')) break;
      if (parent.getAttribute('_entity') === 'true') break;
      if (parent.getAttribute('_tag') === DEFAULT_INSERT_TAG) break;

      runSplitAtCaret();
    }

    const rng = writer.editor!.selection.getRng(true);
    if (
      rng.startContainer.nodeType === Node.TEXT_NODE &&
      (rng.startContainer.parentNode as Element | null)?.getAttribute('_tag') ===
        DEFAULT_INSERT_TAG
    ) {
      runSplitAtCaret();
    }
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
