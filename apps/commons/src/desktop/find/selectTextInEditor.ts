import { findEditorNodeByTeiXPath } from '../xpath/teiXPathWalker';
import type { ResolvedTextHit } from './resolveTextHitInXml';

const unhideNotes = (element: Element) => {
  let node: Element | null = element;
  while (node) {
    if (node.classList.contains('noteWrapper')) {
      node.classList.remove('hide');
    }
    node = node.parentElement;
  }
};

const locateCharacterRange = (
  element: Element,
  startChar: number,
  endChar: number,
): { endNode: Text; endOff: number; startNode: Text; startOff: number } | null => {
  const textSpans: { end: number; node: Text; start: number }[] = [];
  let pos = 0;

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (len > 0) {
        textSpans.push({ node: node as Text, start: pos, end: pos + len });
        pos += len;
      }
      return;
    }

    for (const child of node.childNodes) {
      walk(child);
    }
  };

  walk(element);

  let startNode: Text | null = null;
  let startOff = 0;
  let endNode: Text | null = null;
  let endOff = 0;

  for (const span of textSpans) {
    if (!startNode && startChar >= span.start && startChar <= span.end) {
      startNode = span.node;
      startOff = startChar - span.start;
    }
    if (endChar >= span.start && endChar <= span.end) {
      endNode = span.node;
      endOff = endChar - span.start;
      break;
    }
  }

  if (!startNode || !endNode) return null;

  return { startNode, startOff, endNode, endOff };
};

let activeFindHighlightSpan: HTMLSpanElement | null = null;

const STYLE_ELEMENT_ID = 'lw-find-highlight-styles';

const runWithoutEditorUndo = (fn: () => void) => {
  const editor = window.writer?.editor;
  if (editor?.undoManager?.ignore) {
    editor.undoManager.ignore(fn);
    return;
  }
  fn();
};

const ensureHighlightStyles = (doc: Document) => {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    .lw-find-hit-active {
      background-color: #ffb74d;
      box-shadow: 0 0 0 1px #f57c00;
      border-radius: 1px;
    }
  `;
  doc.head.appendChild(style);
};

const unwrapActiveFindHighlight = () => {
  if (!activeFindHighlightSpan) return;

  const span = activeFindHighlightSpan;
  const parent = span.parentNode;
  if (!parent) {
    activeFindHighlightSpan = null;
    return;
  }

  while (span.firstChild) {
    parent.insertBefore(span.firstChild, span);
  }
  parent.removeChild(span);
  parent.normalize?.();
  activeFindHighlightSpan = null;
};

export const clearActiveFindHighlightInEditor = () => {
  runWithoutEditorUndo(unwrapActiveFindHighlight);
};

/** Highlight the matched characters in WYSIWYG without polluting the undo stack. */
export const highlightTextHitInEditor = (resolved: ResolvedTextHit): boolean => {
  const editor = window.writer?.editor;
  const body = editor?.getBody();
  if (!editor || !body) return false;

  const element = findEditorNodeByTeiXPath(body, resolved.teiXPath);
  if (!element) return false;

  unhideNotes(element);

  const range = locateCharacterRange(
    element,
    resolved.startInElementText,
    resolved.endInElementText,
  );
  if (!range || range.startNode !== range.endNode) return false;

  runWithoutEditorUndo(() => {
    unwrapActiveFindHighlight();

    const doc = range.startNode.ownerDocument;
    ensureHighlightStyles(doc);

    let matchNode = range.startNode;
    if (range.startOff > 0) {
      matchNode = range.startNode.splitText(range.startOff);
    }

    const matchLen = range.endOff - range.startOff;
    if (matchLen < (matchNode.textContent?.length ?? 0)) {
      matchNode.splitText(matchLen);
    }

    const span = doc.createElement('span');
    span.className = 'lw-find-hit-active';
    span.setAttribute('data-lw-find-active', '1');
    matchNode.parentNode?.insertBefore(span, matchNode);
    span.appendChild(matchNode);
    activeFindHighlightSpan = span;
  });

  return true;
};

/** Patch matched text in the WYSIWYG editor without reloading the whole document. */
export const replaceTextHitInEditor = (
  resolved: ResolvedTextHit,
  replacement: string,
): boolean => {
  const editor = window.writer?.editor;
  if (!editor) return false;

  const body = editor.getBody();
  if (!body) return false;

  const element = findEditorNodeByTeiXPath(body, resolved.teiXPath);
  if (!element) return false;

  unhideNotes(element);

  const range = locateCharacterRange(
    element,
    resolved.startInElementText,
    resolved.endInElementText,
  );
  if (!range) return false;

  if (range.startNode !== range.endNode) return false;

  const text = range.startNode.textContent ?? '';
  const nextText = text.slice(0, range.startOff) + replacement + text.slice(range.endOff);

  // Bookend with transact so TinyMCE records one undo step for the text change.
  if (typeof editor.undoManager.transact === 'function') {
    editor.undoManager.transact(() => {
      range.startNode.textContent = nextText;
      editor.nodeChanged();
    });
  } else {
    editor.undoManager.add();
    range.startNode.textContent = nextText;
    editor.nodeChanged();
    editor.undoManager.add();
  }
  editor.focus();
  return true;
};

export const undoWysiwygEditor = (): boolean => {
  const editor = window.writer?.editor;
  if (!editor?.undoManager.hasUndo()) return false;

  editor.focus();
  editor.undoManager.undo();
  return true;
};

export const redoWysiwygEditor = (): boolean => {
  const editor = window.writer?.editor;
  const hasRedo = editor?.undoManager.hasRedo() ?? false;

  if (!editor || !hasRedo) {
    return false;
  }

  editor.focus();
  editor.undoManager.redo();

  return true;
};

/** Scroll to a resolved hit without changing the editor text selection. */
export const scrollToTextHitInEditor = (resolved: ResolvedTextHit): boolean => {
  if (!window.writer?.editor) return false;

  const body = window.writer.editor.getBody();
  if (!body) return false;

  const element = findEditorNodeByTeiXPath(body, resolved.teiXPath);
  if (!element) return false;

  unhideNotes(element);

  const range = locateCharacterRange(
    element,
    resolved.startInElementText,
    resolved.endInElementText,
  );

  const scrollEl = range?.startNode.parentElement ?? element;
  scrollEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
};
