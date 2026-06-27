import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { getInnermostOpenTagName } from './closingTagParser';

export const registerClosingTagCompletion = (): monaco.IDisposable => {
  return monaco.languages.registerCompletionItemProvider('xml', {
    triggerCharacters: ['/', '<'],
    provideCompletionItems: (model, position) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const closingMatch = textUntilPosition.match(/<\/([\w:.-]*)$/);
      if (!closingMatch) return { suggestions: [] };

      const offset = model.getOffsetAt(position);
      const tagName = getInnermostOpenTagName(model.getValue(), offset);
      if (!tagName) return { suggestions: [] };

      const typed = closingMatch[1] ?? '';
      if (typed && !tagName.startsWith(typed)) return { suggestions: [] };

      const wordStart = position.column - typed.length;
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: Math.max(1, wordStart),
        endColumn: position.column,
      };

      return {
        suggestions: [
          {
            label: tagName,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `${tagName}>`,
            range,
            detail: 'Close tag',
          },
        ],
      };
    },
  });
};
