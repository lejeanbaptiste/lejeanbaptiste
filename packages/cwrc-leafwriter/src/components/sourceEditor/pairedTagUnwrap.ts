import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {
  findUnwrapTagPair,
  getInnerContentStart,
  getMirroredNameDeleteEdits,
  getUnwrapEdits,
  type TextDeleteRange,
  type UnwrapTagPair,
} from './closingTagParser';

const selectionMatchesRange = (
  selection: monaco.Selection,
  model: monaco.editor.ITextModel,
  range: { start: number; end: number },
) => {
  const start = model.getOffsetAt(selection.getStartPosition());
  const end = model.getOffsetAt(selection.getEndPosition());
  return start === range.start && end === range.end;
};

const offsetToRange = (model: monaco.editor.ITextModel, range: TextDeleteRange) => {
  const start = model.getPositionAt(range.start);
  const end = model.getPositionAt(range.end);
  return new monaco.Range(
    start.lineNumber,
    start.column,
    end.lineNumber,
    end.column,
  );
};

const executeDeleteRanges = (
  editor: monaco.editor.IStandaloneCodeEditor,
  model: monaco.editor.ITextModel,
  ranges: TextDeleteRange[],
  cursorOffset?: number,
) => {
  editor.executeEdits(
    'unwrapTag',
    ranges.map((range) => ({
      range: offsetToRange(model, range),
      text: '',
      forceMoveMarkers: true,
    })),
  );

  if (cursorOffset !== undefined) {
    const position = model.getPositionAt(cursorOffset);
    editor.setPosition(position);
  }
};

const tryWholeDelimiterUnwrap = (
  editor: monaco.editor.IStandaloneCodeEditor,
  model: monaco.editor.ITextModel,
  pair: UnwrapTagPair,
  selection: monaco.Selection,
): boolean => {
  if (
    selectionMatchesRange(selection, model, pair.openDelimiter) ||
    selectionMatchesRange(selection, model, pair.closeDelimiter)
  ) {
    executeDeleteRanges(editor, model, getUnwrapEdits(pair), getInnerContentStart(pair));
    return true;
  }

  return false;
};

export const registerPairedTagUnwrap = (
  editor: monaco.editor.IStandaloneCodeEditor,
): monaco.IDisposable => {
  return editor.onKeyDown((event) => {
    if (
      event.keyCode !== monaco.KeyCode.Backspace &&
      event.keyCode !== monaco.KeyCode.Delete
    ) {
      return;
    }

    const selections = editor.getSelections();
    if (!selections || selections.length > 1) return;

    const model = editor.getModel();
    if (!model || model.isDisposed()) return;
    if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;

    const selection = editor.getSelection();
    if (!selection) return;

    const content = model.getValue();
    const offset = model.getOffsetAt(selection.getStartPosition());
    const pair = findUnwrapTagPair(content, offset);
    if (!pair) return;

    if (tryWholeDelimiterUnwrap(editor, model, pair, selection)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!selection.isEmpty()) return;

    const mirrored = getMirroredNameDeleteEdits(
      content,
      pair,
      offset,
      event.keyCode === monaco.KeyCode.Backspace,
    );
    if (!mirrored) return;

    event.preventDefault();
    event.stopPropagation();

    if (mirrored === 'unwrap') {
      executeDeleteRanges(editor, model, getUnwrapEdits(pair), getInnerContentStart(pair));
      return;
    }

    const cursorOffset =
      mirrored.length === 2
        ? Math.min(mirrored[0].start, mirrored[1].start)
        : mirrored[0]?.start;

    executeDeleteRanges(editor, model, mirrored, cursorOffset);
  });
};
