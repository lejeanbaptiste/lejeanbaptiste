declare global {
  interface Window {
    __leafWriterSourceFind?: {
      applyJump: (params: {
        content: string;
        end: number;
        query: string;
        start: number;
        useRegex: boolean;
      }) => boolean;
      clear: () => void;
      replaceRange: (params: {
        content: string;
        end: number;
        replacement: string;
        start: number;
      }) => boolean;
      revealRange: (params: { content: string; end: number; start: number }) => boolean;
      scrollToHit: (params: { content: string; end: number; start: number }) => boolean;
      undo: () => Promise<string | null>;
      redo?: () => Promise<string | null>;
    };
  }
}

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

export const clearFindHighlightsInSourceEditor = () => {
  window.__leafWriterSourceFind?.clear();
};

export const applyFindJumpInSourceEditor = (params: {
  content: string;
  end: number;
  query: string;
  start: number;
  useRegex: boolean;
}): boolean => {
  if (!isSourceEditorMode()) return false;
  return window.__leafWriterSourceFind?.applyJump(params) ?? false;
};

export const revealRangeInSourceEditor = (params: {
  content: string;
  end: number;
  focusEditor?: boolean;
  start: number;
}): boolean => {
  if (!isSourceEditorMode()) return false;
  return window.__leafWriterSourceFind?.revealRange(params) ?? false;
};

export const scrollToSourceFindHit = (params: {
  content: string;
  end: number;
  start: number;
}): boolean => {
  if (!isSourceEditorMode()) return false;
  return window.__leafWriterSourceFind?.scrollToHit(params) ?? false;
};

export const getActiveEditorContent = (fallbackContent?: string) => {
  if (isSourceEditorMode()) {
    return window.writer?.overmindState?.ui?.sourceCurrentContent || fallbackContent || '';
  }

  return fallbackContent ?? '';
};
