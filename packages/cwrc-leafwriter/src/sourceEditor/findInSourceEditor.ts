import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const FIND_DECORATION_CLASS = 'lw-source-find-hit';
const FIND_ACTIVE_DECORATION_CLASS = 'lw-source-find-hit-active';

let decorationCollection: monaco.editor.IEditorDecorationsCollection | undefined;
let registeredEditor: monaco.editor.IStandaloneCodeEditor | null = null;

const buildSearchRegex = (query: string, useRegex: boolean) => {
  if (useRegex) {
    try {
      return new RegExp(query, 'gu');
    } catch {
      return null;
    }
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'gu');
};

const offsetToPosition = (content: string, offset: number) => {
  let line = 1;
  let lineStart = 0;

  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line += 1;
      lineStart = i + 1;
    }
  }

  return { lineNumber: line, column: offset - lineStart + 1 };
};

const offsetToRange = (content: string, start: number, end: number) => {
  const from = offsetToPosition(content, start);
  const to = offsetToPosition(content, end);
  return new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column);
};

export const registerSourceFindEditor = (editor: monaco.editor.IStandaloneCodeEditor | null) => {
  registeredEditor = editor;
  if (!editor) {
    decorationCollection?.clear();
    decorationCollection = undefined;
  }
};

export const clearFindHighlightsInSourceEditor = () => {
  decorationCollection?.clear();
  decorationCollection = undefined;
};

export const revealRangeInSourceEditor = ({
  content,
  start,
  end,
}: {
  content: string;
  start: number;
  end: number;
}): boolean => {
  const editor = registeredEditor;
  if (!editor) return false;

  ensureHighlightStyles();
  clearFindHighlightsInSourceEditor();

  const range = offsetToRange(content, start, end);
  decorationCollection = editor.createDecorationsCollection([
    {
      range,
      options: {
        className: FIND_ACTIVE_DECORATION_CLASS,
        inlineClassName: FIND_ACTIVE_DECORATION_CLASS,
        isWholeLine: end - start > 120,
      },
    },
  ]);

  editor.revealRangeInCenter(range);
  editor.setSelection(range);
  editor.focus();
  return true;
};

export const applyFindJumpInSourceEditor = ({
  content,
  query,
  useRegex,
  start,
  end,
}: {
  content: string;
  query: string;
  useRegex: boolean;
  start: number;
  end: number;
}): boolean => {
  const editor = registeredEditor;
  if (!editor || !query.trim()) return false;

  ensureHighlightStyles();
  clearFindHighlightsInSourceEditor();

  const regex = buildSearchRegex(query.trim(), useRegex);
  if (!regex) return false;

  const decorations: monaco.editor.IModelDeltaDecoration[] = [];
  let activeDecorationIndex = -1;

  for (const match of content.matchAll(regex)) {
    if (match.index === undefined) continue;

    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    const isActive = matchStart === start && matchEnd === end;

    decorations.push({
      range: offsetToRange(content, matchStart, matchEnd),
      options: {
        className: isActive ? FIND_ACTIVE_DECORATION_CLASS : FIND_DECORATION_CLASS,
        inlineClassName: isActive ? FIND_ACTIVE_DECORATION_CLASS : FIND_DECORATION_CLASS,
      },
    });

    if (isActive) {
      activeDecorationIndex = decorations.length - 1;
    }

    if (match[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  if (decorations.length === 0) {
    decorations.push({
      range: offsetToRange(content, start, end),
      options: {
        className: FIND_ACTIVE_DECORATION_CLASS,
        inlineClassName: FIND_ACTIVE_DECORATION_CLASS,
      },
    });
    activeDecorationIndex = 0;
  } else if (activeDecorationIndex < 0) {
    decorations[0].options = {
      className: FIND_ACTIVE_DECORATION_CLASS,
      inlineClassName: FIND_ACTIVE_DECORATION_CLASS,
    };
  }

  decorationCollection = editor.createDecorationsCollection(decorations);

  const jumpRange = offsetToRange(content, start, end);
  editor.revealRangeInCenter(jumpRange);
  editor.setSelection(jumpRange);
  editor.focus();

  return true;
};

const ensureHighlightStyles = () => {
  if (document.getElementById('lw-source-find-styles')) return;

  const style = document.createElement('style');
  style.id = 'lw-source-find-styles';
  style.textContent = `
    .${FIND_DECORATION_CLASS} {
      background-color: #fff176;
      border-radius: 1px;
    }
    .${FIND_ACTIVE_DECORATION_CLASS} {
      background-color: #ffb74d;
      box-shadow: 0 0 0 1px #f57c00;
      border-radius: 1px;
    }
  `;
  document.head.appendChild(style);
};

export const DESKTOP_OPEN_FIND_EVENT = 'desktop:open-find';

declare global {
  interface Window {
    __leafWriterSourceFind?: {
      applyJump: typeof applyFindJumpInSourceEditor;
      clear: typeof clearFindHighlightsInSourceEditor;
      revealRange: typeof revealRangeInSourceEditor;
    };
  }
}

window.__leafWriterSourceFind = {
  applyJump: applyFindJumpInSourceEditor,
  clear: clearFindHighlightsInSourceEditor,
  revealRange: revealRangeInSourceEditor,
};

export const dispatchDesktopOpenFind = () => {
  window.dispatchEvent(new CustomEvent(DESKTOP_OPEN_FIND_EVENT));
};
