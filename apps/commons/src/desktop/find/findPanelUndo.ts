import { redoDocumentEditor, undoDocumentEditor } from '../editorUndoRedo';

/** Route undo/redo to the document editor when the find panel field is focused. */
export const useFindPanelUndo = () => {
  const handleFindPanelUndoKeyDown = (event: React.KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey)) return;

    const key = event.key.toLowerCase();
    const isUndo = key === 'z' && !event.shiftKey;
    const isRedo = (key === 'z' && event.shiftKey) || key === 'y';

    if (!isUndo && !isRedo) return;

    event.preventDefault();
    event.stopPropagation();

    void (async () => {
      await (isUndo ? undoDocumentEditor() : redoDocumentEditor());
    })();
  };

  return { handleFindPanelUndoKeyDown };
};
