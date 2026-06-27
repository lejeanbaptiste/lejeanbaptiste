import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const FIND_DECORATION_CLASS = 'lw-source-find-hit';
const FIND_ACTIVE_DECORATION_CLASS = 'lw-source-find-hit-active';

let decorationCollection: monaco.editor.IEditorDecorationsCollection | undefined;
let registeredEditor: monaco.editor.IStandaloneCodeEditor | null = null;
let cachedHitRanges: { end: number; start: number }[] = [];

const revealFindHitRange = (
  editor: monaco.editor.IStandaloneCodeEditor,
  range: monaco.IRange,
) => {
  editor.revealRangeInCenterIfOutsideViewport(range, monaco.editor.ScrollType.Immediate);
};

const applyDecorationsForHits = (
  editor: monaco.editor.IStandaloneCodeEditor,
  content: string,
  hits: { end: number; start: number }[],
  activeStart: number,
  activeEnd: number,
) => {
  const decorations: monaco.editor.IModelDeltaDecoration[] = hits.map(({ start, end }) => {
    const isActive = start === activeStart && end === activeEnd;
    return {
      range: offsetToRange(content, start, end),
      options: {
        className: isActive ? FIND_ACTIVE_DECORATION_CLASS : FIND_DECORATION_CLASS,
        inlineClassName: isActive ? FIND_ACTIVE_DECORATION_CLASS : FIND_DECORATION_CLASS,
      },
    };
  });

  decorationCollection?.clear();
  decorationCollection = editor.createDecorationsCollection(decorations);
};

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
  cachedHitRanges = [];
};

export const revealRangeInSourceEditor = ({
  content,
  start,
  end,
  focusEditor = true,
}: {
  content: string;
  end: number;
  focusEditor?: boolean;
  start: number;
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

  revealFindHitRange(editor, range);
  if (focusEditor) {
    editor.focus();
  }
  return true;
};

/** Scroll to a hit during cycling without re-scanning the file or forcing center scroll. */
export const scrollToSourceFindHit = ({
  content,
  end,
  start,
}: {
  content: string;
  end: number;
  start: number;
}): boolean => {
  const editor = registeredEditor;
  if (!editor) return false;

  ensureHighlightStyles();

  if (cachedHitRanges.length > 0) {
    applyDecorationsForHits(editor, content, cachedHitRanges, start, end);
  } else {
    const jumpRange = offsetToRange(content, start, end);
    revealFindHitRange(editor, jumpRange);
    return false;
  }

  const jumpRange = offsetToRange(content, start, end);
  revealFindHitRange(editor, jumpRange);

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

  const hits: { end: number; start: number }[] = [];

  for (const match of content.matchAll(regex)) {
    if (match.index === undefined) continue;

    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    hits.push({ start: matchStart, end: matchEnd });

    if (match[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  if (hits.length === 0) {
    hits.push({ start, end });
  }

  cachedHitRanges = hits;
  applyDecorationsForHits(editor, content, hits, start, end);

  const jumpRange = offsetToRange(content, start, end);
  revealFindHitRange(editor, jumpRange);

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

export const replaceRangeInSourceEditor = ({
  content,
  end,
  replacement,
  start,
}: {
  content: string;
  end: number;
  replacement: string;
  start: number;
}): boolean => {
  const editor = registeredEditor;
  if (!editor) return false;

  const range = offsetToRange(content, start, end);
  const ok = editor.executeEdits('find-replace', [
    {
      range,
      text: replacement,
      forceMoveMarkers: true,
    },
  ]);

  if (ok) {
    cachedHitRanges = [];
    const newEnd = start + replacement.length;
    const selectionRange = offsetToRange(editor.getValue(), start, newEnd);
    editor.setSelection(selectionRange);
    editor.focus();
  }

  return ok;
};

export const undoSourceEditor = async (): Promise<string | null> => {
  const editor = registeredEditor;
  if (!editor) return null;

  const before = editor.getValue();
  editor.focus();
  const action = editor.getAction('editor.action.undo');
  if (action) {
    await Promise.resolve(action.run());
  } else {
    editor.trigger('keyboard', 'editor.action.undo', null);
  }

  const after = editor.getValue();
  if (after === before) return null;

  window.writer?.overmindActions?.ui?.setSourceCurrentContent?.(after);

  return after;
};

export const redoSourceEditor = async (): Promise<string | null> => {
  const editor = registeredEditor;
  if (!editor) return null;

  const before = editor.getValue();
  editor.focus();
  const action = editor.getAction('editor.action.redo');
  if (action) {
    await Promise.resolve(action.run());
  } else {
    editor.trigger('keyboard', 'editor.action.redo', null);
  }

  const after = editor.getValue();

  if (after === before) {
    return null;
  }

  window.writer?.overmindActions?.ui?.setSourceCurrentContent?.(after);

  return after;
};

export const DESKTOP_OPEN_FIND_EVENT = 'desktop:open-find';

declare global {
  interface Window {
    __leafWriterSourceFind?: {
      applyJump: typeof applyFindJumpInSourceEditor;
      clear: typeof clearFindHighlightsInSourceEditor;
      replaceRange: typeof replaceRangeInSourceEditor;
      revealRange: typeof revealRangeInSourceEditor;
      scrollToHit: typeof scrollToSourceFindHit;
      undo: typeof undoSourceEditor;
      redo: typeof redoSourceEditor;
    };
  }
}

window.__leafWriterSourceFind = {
  applyJump: applyFindJumpInSourceEditor,
  clear: clearFindHighlightsInSourceEditor,
  replaceRange: replaceRangeInSourceEditor,
  revealRange: revealRangeInSourceEditor,
  scrollToHit: scrollToSourceFindHit,
  undo: undoSourceEditor,
  redo: redoSourceEditor,
};

export const dispatchDesktopOpenFind = () => {
  window.dispatchEvent(new CustomEvent(DESKTOP_OPEN_FIND_EVENT));
};
