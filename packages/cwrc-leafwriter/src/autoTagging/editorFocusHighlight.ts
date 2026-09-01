/**
 * Visible "you are here" marker in the WYSIWYG editor for panel-driven jumps
 * (review, dates, disambiguation).
 *
 * A TinyMCE selection alone is not enough: the editor lives in an iframe, so
 * while a side panel holds DOM focus the browser does not paint the editor's
 * selection at all — the panel walks the document and the user sees nothing
 * move. The Find panel solved this by wrapping the hit in a span; we prefer
 * the CSS Custom Highlight API (no DOM mutation, nothing to leak into the
 * serialized XML, no undo noise) and keep the span as the fallback where that
 * API is missing.
 */

export interface FocusHighlightEditor {
  getBody: () => HTMLElement;
  getDoc: () => Document;
  getWin?: () => Window | null | undefined;
  undoManager?: { ignore?: (fn: () => void) => void };
}

const HIGHLIGHT_NAME = 'lw-autotag-focus';
const STYLE_ELEMENT_ID = 'lw-autotag-focus-styles';

interface HighlightCapableWindow extends Window {
  Highlight?: new (...ranges: Range[]) => unknown;
  CSS?: typeof CSS & { highlights?: Map<string, unknown> };
}

let activeRegistry: Map<string, unknown> | null = null;
let activeSpan: HTMLSpanElement | null = null;

const editorWindow = (editor: FocusHighlightEditor): HighlightCapableWindow | null => {
  try {
    return (editor.getWin?.() ?? editor.getDoc().defaultView) as HighlightCapableWindow | null;
  } catch {
    return null;
  }
};

const runWithoutUndo = (editor: FocusHighlightEditor, fn: () => void) => {
  if (editor.undoManager?.ignore) editor.undoManager.ignore(fn);
  else fn();
};

/** Notes render collapsed; a mention inside one is invisible until unhidden. */
const unhideNotes = (node: Node | null) => {
  let element = node instanceof Element ? node : node?.parentElement;
  while (element) {
    if (element.classList?.contains('noteWrapper')) element.classList.remove('hide');
    element = element.parentElement;
  }
};

const ensureStyles = (doc: Document) => {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    ::highlight(${HIGHLIGHT_NAME}) {
      background-color: #ffb74d;
      color: inherit;
    }
    .${HIGHLIGHT_NAME} {
      background-color: #ffb74d;
      box-shadow: 0 0 0 1px #f57c00;
      border-radius: 1px;
    }
  `;
  (doc.head ?? doc.documentElement)?.appendChild(style);
};

const unwrapActiveSpan = () => {
  const span = activeSpan;
  activeSpan = null;
  const parent = span?.parentNode;
  if (!span || !parent) return;
  while (span.firstChild) parent.insertBefore(span.firstChild, span);
  parent.removeChild(span);
  parent.normalize?.();
};

/** Drop any highlight this module is currently showing. Safe to call twice. */
export const clearFocusHighlight = (editor?: FocusHighlightEditor): void => {
  try {
    activeRegistry?.delete(HIGHLIGHT_NAME);
    activeRegistry = null;
    if (!activeSpan) return;
    if (editor) runWithoutUndo(editor, unwrapActiveSpan);
    else unwrapActiveSpan();
  } catch {
    // clearing a highlight must never break the caller
    activeRegistry = null;
    activeSpan = null;
  }
};

/**
 * Paint `[start, end)` of `node` as the focused mention and scroll it into
 * view. Returns false when nothing could be painted (the caller keeps the
 * editor selection it already set, which is still correct for typing).
 */
export const showFocusHighlight = (
  editor: FocusHighlightEditor,
  node: Text,
  start: number,
  end: number,
): boolean => {
  clearFocusHighlight(editor);

  try {
    const doc = node.ownerDocument;
    if (!doc || !node.isConnected || end <= start) return false;

    unhideNotes(node);
    ensureStyles(doc);

    const win = editorWindow(editor);
    const registry = win?.CSS?.highlights;
    let painted = false;

    if (registry && typeof win?.Highlight === 'function') {
      const range = doc.createRange();
      range.setStart(node, start);
      range.setEnd(node, Math.min(end, node.data.length));
      registry.set(HIGHLIGHT_NAME, new win.Highlight(range));
      activeRegistry = registry;
      painted = true;
    } else {
      runWithoutUndo(editor, () => {
        let matchNode = node;
        if (start > 0) matchNode = matchNode.splitText(start);
        const length = Math.min(end - start, matchNode.data.length);
        if (length < matchNode.data.length) matchNode.splitText(length);
        const span = doc.createElement('span');
        span.className = HIGHLIGHT_NAME;
        span.setAttribute('data-lw-autotag-focus', '1');
        matchNode.parentNode?.insertBefore(span, matchNode);
        span.appendChild(matchNode);
        activeSpan = span;
      });
      painted = activeSpan !== null;
    }

    const target = activeSpan ?? node.parentElement;
    target?.scrollIntoView?.({ block: 'center' });
    return painted;
  } catch {
    return false;
  }
};

/** True when the fallback span (not the CSS highlight) is currently in the DOM. */
export const focusHighlightMutatesDom = (): boolean => activeSpan !== null;
