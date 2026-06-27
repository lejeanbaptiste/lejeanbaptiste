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
