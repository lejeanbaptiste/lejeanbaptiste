import { clearActiveFindHighlightInEditor } from '../find/selectTextInEditor';

const STYLE_ELEMENT_ID = 'lw-tag-walk-highlight-styles';
const ACTIVE_CLASS = 'lw-tag-walk-hit-active';
const ELEMENT_CLASS = 'lw-tag-walk-element-active';

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
    .${ACTIVE_CLASS} {
      background-color: #ffb74d;
      box-shadow: 0 0 0 1px #f57c00;
      border-radius: 1px;
    }
    .${ELEMENT_CLASS} {
      outline: 2px solid #f57c00;
      outline-offset: 2px;
    }
  `;
  doc.head.appendChild(style);
};

export const clearTagWalkHighlight = () => {
  runWithoutEditorUndo(() => {
    clearActiveFindHighlightInEditor();

    const body = window.writer?.editor?.getBody();
    if (!body) return;

    body.querySelectorAll(`.${ACTIVE_CLASS}`).forEach((element) => {
      const parent = element.parentNode;
      if (!parent) return;
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
    });

    body.querySelectorAll(`.${ELEMENT_CLASS}`).forEach((element) => {
      element.classList.remove(ELEMENT_CLASS);
    });

    body.normalize?.();
  });
};

const isRangeLike = (value: unknown): value is Range =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'startContainer' in value &&
      'startOffset' in value,
  );

const resolveScrollElement = (target: Range | Element): Element | null => {
  if (target instanceof Element) return target;
  if (!isRangeLike(target)) return null;

  const container = target.startContainer;
  if (container.nodeType === Node.TEXT_NODE) return container.parentElement;
  if (container.nodeType === Node.ELEMENT_NODE) return container as Element;
  return null;
};

export const scrollTagWalkTargetIntoView = (target: Range | Element) => {
  const node = resolveScrollElement(target);
  if (node && typeof node.scrollIntoView === 'function') {
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
};

/** Highlight an exact text range for queue-walk (undo-safe, same look as find active hit). */
export const highlightTagWalkRange = (range: Range): boolean => {
  if (range.startContainer !== range.endContainer) return false;
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return false;

  const startNode = range.startContainer as Text;
  const startOff = range.startOffset;
  const endOff = range.endOffset;
  if (startOff >= endOff) return false;

  runWithoutEditorUndo(() => {
    clearTagWalkHighlight();
    ensureHighlightStyles(startNode.ownerDocument);

    let matchNode = startNode;
    if (startOff > 0) {
      matchNode = startNode.splitText(startOff);
    }

    const matchLen = endOff - startOff;
    if (matchLen < (matchNode.textContent?.length ?? 0)) {
      matchNode.splitText(matchLen);
    }

    const span = startNode.ownerDocument.createElement('span');
    span.className = ACTIVE_CLASS;
    span.setAttribute('data-lw-tag-walk-active', '1');
    matchNode.parentNode?.insertBefore(span, matchNode);
    span.appendChild(matchNode);
  });

  return true;
};

export const highlightTagWalkElement = (element: Element) => {
  runWithoutEditorUndo(() => {
    clearTagWalkHighlight();
    ensureHighlightStyles(element.ownerDocument);
    element.classList.add(ELEMENT_CLASS);
  });
};
