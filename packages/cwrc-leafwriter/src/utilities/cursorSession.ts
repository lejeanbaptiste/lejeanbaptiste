import { getCursorOffsetInSourceEditor, setCursorOffsetInSourceEditor } from '../sourceEditor/findInSourceEditor';
import { getVisualCaretForSourceSync, type VisualCaretPosition } from './sourceCursorSync';

export type LeafWriterCursorPosition =
  | ({ mode: 'source' } & { offset: number })
  | ({ mode: 'visual' } & VisualCaretPosition);

const localTagName = (name: string) => (name.includes(':') ? name.split(':').pop()! : name);

const parseXPathSegments = (xpath: string) =>
  xpath
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^(?:[\w.-]+:)*([\w.-]+)(?:\[(\d+)\])?$/);
      return {
        tag: localTagName(match?.[1] ?? segment.replace(/\[.*\]/, '')),
        index: match?.[2] ? parseInt(match[2], 10) - 1 : 0,
      };
    });

const findElementByTeiXPath = (xpath: string): Element | null => {
  const body = window.writer?.editor?.getBody();
  if (!body) {
    console.info('[cursor-session] visual restore lookup failed: no editor body', { xpath });
    return null;
  }

  let scope: ParentNode = body;
  let current: Element | null = null;

  for (const segment of parseXPathSegments(xpath)) {
    const matches = Array.from(scope.children).filter((element) => {
      const tag = element.getAttribute('_tag');
      return tag && localTagName(tag).toLowerCase() === segment.tag.toLowerCase();
    });
    current = matches[segment.index] ?? null;
    if (!current) {
      console.info('[cursor-session] visual restore lookup failed: missing segment', {
        available: matches.map((element) => element.getAttribute('_tag')),
        index: segment.index,
        segment,
        xpath,
      });
      return null;
    }
    scope = current;
  }

  return current;
};

const setVisualCaret = ({ offsetInElementText, teiXPath }: VisualCaretPosition): boolean => {
  const editor = window.writer?.editor;
  const element = findElementByTeiXPath(teiXPath);
  if (!editor || !element) {
    console.info('[cursor-session] visual restore failed: editor or element unavailable', {
      hasEditor: Boolean(editor),
      hasElement: Boolean(element),
      offsetInElementText,
      teiXPath,
    });
    return false;
  }

  const doc = element.ownerDocument;
  const range = doc.createRange();
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offsetInElementText);
  let textNode = walker.nextNode();
  let visitedTextLength = 0;

  while (textNode) {
    const length = textNode.textContent?.length ?? 0;
    if (remaining <= length) {
      range.setStart(textNode, remaining);
      range.collapse(true);
      editor.selection.setRng(range);
      editor.currentNode = element;
      editor.focus();
      element.scrollIntoView({ block: 'center' });
      window.writer?.event('nodeChanged').publish(element);
      console.info('[cursor-session] visual restore applied', {
        nodePreview: textNode.textContent?.slice(0, 80),
        offsetInTextNode: remaining,
        teiXPath,
        visitedTextLength,
      });
      return true;
    }
    remaining -= length;
    visitedTextLength += length;
    textNode = walker.nextNode();
  }

  range.selectNodeContents(element);
  range.collapse(false);
  editor.selection.setRng(range);
  editor.currentNode = element;
  editor.focus();
  element.scrollIntoView({ block: 'center' });
  window.writer?.event('nodeChanged').publish(element);
  console.info('[cursor-session] visual restore applied at element end', {
    offsetInElementText,
    teiXPath,
    visitedTextLength,
  });
  return true;
};

export const captureLeafWriterCursorPosition = (): LeafWriterCursorPosition | null => {
  const mode = window.writer?.overmindState?.ui?.editorViewMode;
  if (mode === 'source') {
    const offset = getCursorOffsetInSourceEditor();
    console.info('[cursor-session] source capture', {
      mode,
      offset,
    });
    return typeof offset === 'number' ? { mode: 'source', offset } : null;
  }

  const visualCaret = getVisualCaretForSourceSync();
  console.info('[cursor-session] visual capture', {
    mode,
    visualCaret,
    currentNodeTag:
      window.writer?.editor?.currentNode instanceof Element
        ? window.writer.editor.currentNode.getAttribute('_tag')
        : null,
    selectionText: window.writer?.editor?.selection?.getRng?.()?.toString?.() ?? null,
  });
  return visualCaret ? { mode: 'visual', ...visualCaret } : null;
};

export const restoreLeafWriterCursorPosition = async (
  position: LeafWriterCursorPosition,
): Promise<boolean> => {
  console.info('[cursor-session] editor restore requested', {
    editorViewMode: window.writer?.overmindState?.ui?.editorViewMode,
    position,
  });
  if (position.mode === 'source') {
    await window.writer?.overmindActions?.ui?.enterSourceMode?.();
    const restored = setCursorOffsetInSourceEditor({ offset: position.offset, focusEditor: true });
    console.info('[cursor-session] source restore result', {
      offset: position.offset,
      restored,
    });
    return restored;
  }

  window.writer?.overmindActions?.ui?.setEditorViewMode?.('visual');
  return setVisualCaret(position);
};

declare global {
  interface Window {
    __leafWriterCursorSession?: {
      capture: typeof captureLeafWriterCursorPosition;
      restore: typeof restoreLeafWriterCursorPosition;
    };
  }
}

window.__leafWriterCursorSession = {
  capture: captureLeafWriterCursorPosition,
  restore: restoreLeafWriterCursorPosition,
};
