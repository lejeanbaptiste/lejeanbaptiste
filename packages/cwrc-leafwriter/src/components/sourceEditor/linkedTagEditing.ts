import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { findLinkedTagNameRanges } from './closingTagParser';

const XML_TAG_NAME_PATTERN = /^[\w:.-]+$/;

const toMonacoRange = (
  model: monaco.editor.ITextModel,
  start: number,
  end: number,
): monaco.IRange => {
  const startPosition = model.getPositionAt(start);
  const endPosition = model.getPositionAt(end);
  return new monaco.Range(
    startPosition.lineNumber,
    startPosition.column,
    endPosition.lineNumber,
    endPosition.column,
  );
};

export const registerLinkedTagEditing = (): monaco.IDisposable => {
  return monaco.languages.registerLinkedEditingRangeProvider('xml', {
    provideLinkedEditingRanges: (model, position) => {
      const offset = model.getOffsetAt(position);
      const ranges = findLinkedTagNameRanges(model.getValue(), offset);

      if (!ranges) return null;

      const monacoRanges = ranges.map(({ start, end }) => toMonacoRange(model, start, end));

      return {
        ranges: monacoRanges,
        wordPattern: XML_TAG_NAME_PATTERN,
      };
    },
  });
};
