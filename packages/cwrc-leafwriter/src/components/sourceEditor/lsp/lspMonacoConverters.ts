import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import type {
  CompletionItem,
  CompletionList,
  MarkedString,
  MarkupContent,
} from 'vscode-languageserver-protocol';

const markupToString = (content: MarkupContent | MarkedString | string | undefined): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if ('language' in content) return content.value;
  return content.value;
};

export const toMonacoCompletionItems = (
  result: CompletionItem[] | CompletionList | null,
  range: monaco.IRange,
): monaco.languages.CompletionItem[] => {
  if (!result) return [];

  const items = Array.isArray(result) ? result : result.items ?? [];

  return items.map((item) => {
    const label = item.label;

    const monacoItem: monaco.languages.CompletionItem = {
      label,
      kind:
        (item.kind as monaco.languages.CompletionItemKind | undefined) ??
        monaco.languages.CompletionItemKind.Text,
      detail: item.detail,
      documentation: markupToString(item.documentation),
      insertText: item.insertText ?? label,
      range,
      sortText: item.sortText,
      filterText: item.filterText,
    };

    if (item.textEdit?.newText) {
      monacoItem.insertText = item.textEdit.newText;
      if ('range' in item.textEdit && item.textEdit.range) {
        monacoItem.range = {
          startLineNumber: item.textEdit.range.start.line + 1,
          startColumn: item.textEdit.range.start.character + 1,
          endLineNumber: item.textEdit.range.end.line + 1,
          endColumn: item.textEdit.range.end.character + 1,
        };
      }
    }

    return monacoItem;
  });
};

export const toMonacoHover = (
  hover: {
    contents: MarkupContent | MarkupContent[] | MarkedString | MarkedString[] | string;
  } | null,
): monaco.languages.Hover | null => {
  if (!hover) return null;

  const contents = Array.isArray(hover.contents)
    ? hover.contents.map(markupToString).join('\n\n')
    : markupToString(hover.contents as MarkupContent | string);

  if (!contents) return null;
  return { contents: [{ value: contents }] };
};
