import { redoWysiwygEditor, undoWysiwygEditor } from './find/selectTextInEditor';

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

const syncOpenTabContent = (content: string) => {
  const filePath =
    window.writer?.overmindState?.editor?.resource?.filePath ??
    window.writer?.overmindState?.project?.activeTabPath;
  if (filePath) {
    window.writer?.overmindActions?.project?.updateTabContent?.({ filePath, content });
  }
};

/** Undo in the active document editor (Source or Visual). */
export const undoDocumentEditor = async (): Promise<boolean> => {
  if (isSourceEditorMode()) {
    const content = (await window.__leafWriterSourceFind?.undo?.()) ?? null;
    if (content === null) return false;
    syncOpenTabContent(content);
    return true;
  }

  return undoWysiwygEditor();
};

/** Redo in the active document editor (Source or Visual). */
export const redoDocumentEditor = async (): Promise<boolean> => {
  if (isSourceEditorMode()) {
    const content = (await window.__leafWriterSourceFind?.redo?.()) ?? null;
    if (content === null) return false;
    syncOpenTabContent(content);
    return true;
  }

  return redoWysiwygEditor();
};
