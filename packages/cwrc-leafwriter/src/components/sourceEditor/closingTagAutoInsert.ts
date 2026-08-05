import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { getClosingTagAutoInsert } from './getClosingTagAutoInsert';

/**
 * When the user types `</`, insert the matching closing tag name (and `>` if
 * needed) immediately — not as a completion suggestion.
 */
export const registerClosingTagAutoInsert = (
  editor: monaco.editor.IStandaloneCodeEditor,
): monaco.IDisposable => {
  // onDidType exists on the runtime editor; some monaco type builds omit it from IStandaloneCodeEditor.
  const typingEditor = editor as monaco.editor.IStandaloneCodeEditor & {
    onDidType: (listener: (typed: string) => void) => monaco.IDisposable;
  };
  return typingEditor.onDidType((typed: string) => {
    if (typed !== '/') return;

    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return;

    const offset = model.getOffsetAt(position);
    const edit = getClosingTagAutoInsert(model.getValue(), offset);
    if (!edit) return;

    const range = new monaco.Range(
      position.lineNumber,
      position.column,
      position.lineNumber,
      position.column,
    );

    editor.executeEdits('closing-tag-auto-insert', [
      { range, text: edit.insertText, forceMoveMarkers: true },
    ]);
    editor.setPosition(model.getPositionAt(edit.cursorOffset));
    // The `/` trigger character may have opened the old fill-suggest popup; dismiss it.
    editor.trigger('closing-tag-auto-insert', 'hideSuggestWidget', null);
  });
};
