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
      revealRange: (params: { content: string; end: number; start: number }) => boolean;
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

export const getActiveEditorContent = (fallbackContent?: string) => {
  if (isSourceEditorMode()) {
    return window.writer?.overmindState?.ui?.sourceCurrentContent || fallbackContent || '';
  }

  return fallbackContent ?? '';
};
