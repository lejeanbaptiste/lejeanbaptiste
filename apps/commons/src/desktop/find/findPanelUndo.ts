import { redoDocumentEditor, undoDocumentEditor } from '../editorUndoRedo';

/** Route undo/redo to the document editor when the find panel field is focused. */
export const useFindPanelUndo = () => {
  const handleFindPanelUndoKeyDown = (event: React.KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey)) return;

    const isUndo = event.code === 'KeyZ' && !event.shiftKey;
    const isRedo =
      (event.code === 'KeyZ' && event.shiftKey) || event.code === 'KeyY';

    if (!isUndo && !isRedo) return;

    event.preventDefault();
    event.stopPropagation();

    void (async () => {
      await (isUndo ? undoDocumentEditor() : redoDocumentEditor());
    })();
  };

  return { handleFindPanelUndoKeyDown };
};
