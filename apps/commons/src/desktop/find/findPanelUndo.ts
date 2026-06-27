import { useActions, useAppState } from '@src/overmind';
import { undoWysiwygEditor } from './selectTextInEditor';

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

/** Route undo to the document editor when the find panel field is focused. */
export const useFindPanelUndo = () => {
  const { activeTabPath } = useAppState().project;
  const { resource } = useAppState().editor;
  const { updateTabContent } = useActions().project;

  const delegateUndoToEditor = (): boolean => {
    if (isSourceEditorMode()) {
      const content = window.__leafWriterSourceFind?.undo() ?? null;
      if (content !== null) {
        const filePath = resource?.filePath ?? activeTabPath;
        if (filePath) {
          updateTabContent({ filePath, content });
        }
        return true;
      }
      return false;
    }

    return undoWysiwygEditor();
  };

  const handleFindPanelUndoKeyDown = (event: React.KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey) || event.code !== 'KeyZ' || event.shiftKey) return;

    if (delegateUndoToEditor()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return { handleFindPanelUndoKeyDown };
};
