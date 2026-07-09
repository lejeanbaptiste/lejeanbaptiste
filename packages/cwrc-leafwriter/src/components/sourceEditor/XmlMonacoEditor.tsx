import { Box, useColorScheme } from '@mui/material';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';
import 'monaco-editor/esm/vs/editor/editor.main';
import 'monaco-editor/esm/vs/editor/contrib/linkedEditing/browser/linkedEditing.js';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useRef, useState } from 'react';
import {
  dispatchDesktopOpenFind,
  registerSourceFindEditor,
} from '../../sourceEditor/findInSourceEditor';
import {
  SOURCE_CURSOR_MOVED_EVENT,
  type SourceCursorMovedDetail,
} from '../editorLocationBar';
import { registerClosingTagCompletion } from './closingTagCompletion';
import { findEnclosingTagPair, getUnwrapEdits } from './closingTagParser';
import { registerLinkedTagEditing } from './linkedTagEditing';
import { registerPairedTagUnwrap } from './pairedTagUnwrap';
import { useXmlLanguageClient } from './useXmlLanguageClient';
import type { LspStartOptions } from './lsp/ipcLspClient';

const TAG_NAME_RE = /^([a-zA-Z_:][\w:.-]*)/;

/**
 * Given raw XML text and a cursor offset, returns the start offset and length
 * of the tag name in the nearest enclosing opening tag.
 * Works whether the cursor is in content, inside an opening tag, or in a closing tag.
 */
const findOpeningTagNameAt = (text: string, offset: number): { start: number; length: number } | null => {
  // Determine if cursor is inside a tag by scanning forward for > vs <
  let insideTag = false;
  for (let i = offset; i < text.length; i++) {
    if (text[i] === '>') { insideTag = true; break; }
    if (text[i] === '<') break;
  }

  let ltPos = -1;

  if (insideTag) {
    // Find the < that opens the tag the cursor is in
    for (let i = offset; i >= 0; i--) {
      if (text[i] === '<') { ltPos = i; break; }
    }
  } else {
    // Cursor is in element content — find the nearest enclosing opening tag
    // by scanning backward and tracking depth (closing tags increase depth,
    // non-self-closing opening tags decrease it; at depth 0 we have our tag).
    let depth = 0;
    let i = offset - 1;
    while (i >= 0) {
      if (text[i] !== '<') { i--; continue; }

      const isClose = text[i + 1] === '/';
      const isProc = text[i + 1] === '!' || text[i + 1] === '?';
      if (isProc) { i--; continue; }

      if (isClose) {
        depth++;
        i--;
        continue;
      }

      // Opening or self-closing tag — check for self-close
      let j = i + 1;
      while (j < text.length && text[j] !== '>') j++;
      const selfClose = text[j - 1] === '/';

      if (!selfClose) {
        if (depth === 0) { ltPos = i; break; }
        depth--;
      }
      i--;
    }
  }

  if (ltPos === -1) return null;

  const isClose = text[ltPos + 1] === '/';
  let nameStart = ltPos + (isClose ? 2 : 1);

  if (isClose) {
    // Cursor is on a closing tag — walk back to the matching opening tag
    const closeNameMatch = TAG_NAME_RE.exec(text.slice(nameStart));
    if (!closeNameMatch) return null;
    const closeName = closeNameMatch[1];

    let depth = 1;
    let i = ltPos - 1;
    while (i >= 0 && depth > 0) {
      if (text[i] !== '<') { i--; continue; }
      const inner = text[i + 1] === '/' ? i + 2 : i + 1;
      const m = TAG_NAME_RE.exec(text.slice(inner));
      if (m && m[1] === closeName) {
        if (text[i + 1] === '/') depth++;
        else depth--;
        if (depth === 0) { nameStart = inner; break; }
      }
      i--;
    }
    if (depth !== 0) return null;
  }

  const nameMatch = TAG_NAME_RE.exec(text.slice(nameStart));
  if (!nameMatch) return null;
  return { start: nameStart, length: nameMatch[1].length };
};

export interface XmlMonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onEditorInstance?: (editor: monaco.editor.IStandaloneCodeEditor | null) => void;
  errorPositions?: { line: number; col: number }[];
  markers?: monaco.editor.IMarkerData[];
  minHeight?: number | string;
  /** On-disk path for LSP document URI (desktop Source mode autofill). */
  documentPath?: string | null;
  lspOptions?: LspStartOptions;
}

export const XmlMonacoEditor = ({
  value,
  onChange,
  onEditorInstance,
  errorPositions,
  markers,
  minHeight = 600,
  documentPath,
  lspOptions,
}: XmlMonacoEditorProps) => {
  const { mode, systemMode } = useColorScheme();
  const divEl = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onEditorInstanceRef = useRef(onEditorInstance);
  const lastEditorValueRef = useRef(value);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [decorations, setDecorations] = useState<
    monaco.editor.IEditorDecorationsCollection | undefined
  >(undefined);

  onChangeRef.current = onChange;
  onEditorInstanceRef.current = onEditorInstance;

  const isDarkMode = mode === 'dark' || (mode === 'system' && systemMode === 'dark');
  const theme = isDarkMode ? 'vs-dark' : 'vs-light';

  useXmlLanguageClient({ documentPath, editor, lspOptions, value });

  useEffect(() => {
    if (!divEl.current) return;

    const closingTagDisposable = registerClosingTagCompletion();
    const linkedTagDisposable = registerLinkedTagEditing();

    const monacoEditor = monaco.editor.create(divEl.current, {
      automaticLayout: true,
      lineNumbers: 'on',
      language: 'xml',
      linkedEditing: true,
      theme,
      value,
      wordWrap: 'wordWrapColumn',
      wordWrapColumn: 100,
      wrappingIndent: 'indent',
    });

    monacoEditor.getModel()?.onDidChangeContent(() => {
      const nextValue = monacoEditor.getValue();
      lastEditorValueRef.current = nextValue;
      onChangeRef.current(nextValue);
    });

    monacoEditor.onDidChangeCursorSelection(() => {
      const model = monacoEditor.getModel();
      if (!model) return;
      const offset = model.getOffsetAt(monacoEditor.getPosition() ?? { lineNumber: 1, column: 1 });
      window.dispatchEvent(
        new CustomEvent<SourceCursorMovedDetail>(SOURCE_CURSOR_MOVED_EVENT, {
          detail: { offset },
        }),
      );
    });

    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
      void monacoEditor.getAction('editor.action.redo')?.run();
    });

    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
      void monacoEditor.getAction('editor.action.redo')?.run();
    });

    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      dispatchDesktopOpenFind();
    });

    monacoEditor.addAction({
      id: 'wrap-selection-in-tag',
      label: 'Wrap selection in tag',
      keybindings: [monaco.KeyCode.Enter],
      precondition: 'editorHasSelection',
      run: (editor) => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!selection || selection.isEmpty() || !model) return;

        const selectedText = model.getValueInRange(selection);
        const wrapped = `<tag>${selectedText}</tag>`;

        editor.executeEdits('wrap-tag', [{ range: selection, text: wrapped }]);

        // Place cursor selecting "tag" in the opening tag so linked editing propagates
        const tagNameStart = model.getOffsetAt({
          lineNumber: selection.startLineNumber,
          column: selection.startColumn,
        }) + 1; // step past '<'
        const startPos = model.getPositionAt(tagNameStart);
        editor.setSelection(new monaco.Range(
          startPos.lineNumber, startPos.column,
          startPos.lineNumber, startPos.column + 3, // length of "tag"
        ));
      },
    });

    monacoEditor.addAction({
      id: 'delete-enclosing-tag',
      label: 'Delete enclosing tag',
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyCode.Backspace,
        monaco.KeyMod.Shift | monaco.KeyCode.Delete,
      ],
      run: (editor) => {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (!model || !selection) return;

        const content = model.getValue();
        const offset = model.getOffsetAt(selection.getStartPosition());
        const pair = findEnclosingTagPair(content, offset);
        if (!pair) return;

        const tagName = content.slice(pair.openName.start, pair.openName.end);
        if (tagName === window.writer?.schemaManager?.getRoot()) return;

        editor.executeEdits(
          'delete-enclosing-tag',
          getUnwrapEdits(pair).map((range) => {
            const start = model.getPositionAt(range.start);
            const end = model.getPositionAt(range.end);
            return {
              range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
              text: '',
              forceMoveMarkers: true,
            };
          }),
        );

        // pair.openDelimiter.start is unaffected by either deletion (both removed ranges sit
        // at or after it), so it's valid as-is against the post-edit model.
        editor.setPosition(model.getPositionAt(pair.openDelimiter.start));
      },
    });

    monacoEditor.addCommand(monaco.KeyCode.F2, () => {
      const model = monacoEditor.getModel();
      const position = monacoEditor.getPosition();
      if (!model || !position) return;

      const text = model.getValue();
      const offset = model.getOffsetAt(position);
      const nameRange = findOpeningTagNameAt(text, offset);
      if (!nameRange) return;

      const start = model.getPositionAt(nameRange.start);
      const end = model.getPositionAt(nameRange.start + nameRange.length);
      const range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
      monacoEditor.setSelection(range);
      monacoEditor.revealRangeInCenterIfOutsideViewport(range);
    });

    registerSourceFindEditor(monacoEditor);
    const pairedTagUnwrapDisposable = registerPairedTagUnwrap(monacoEditor);
    lastEditorValueRef.current = value;
    const model = monacoEditor.getModel();
    if (model) {
      const offset = model.getOffsetAt(monacoEditor.getPosition() ?? { lineNumber: 1, column: 1 });
      window.dispatchEvent(
        new CustomEvent<SourceCursorMovedDetail>(SOURCE_CURSOR_MOVED_EVENT, {
          detail: { offset },
        }),
      );
    }
    setEditor(monacoEditor);
    onEditorInstanceRef.current?.(monacoEditor);

    return () => {
      closingTagDisposable.dispose();
      linkedTagDisposable.dispose();
      pairedTagUnwrapDisposable.dispose();
      registerSourceFindEditor(null);
      onEditorInstanceRef.current?.(null);
      monacoEditor.dispose();
      setEditor(null);
    };
  }, [mode, systemMode]);

  useEffect(() => {
    editor?.updateOptions({ theme });
  }, [editor, theme]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastEditorValueRef.current) return;

    const model = editor.getModel();
    if (!model || model.getValue() === value) {
      lastEditorValueRef.current = value;
      return;
    }

    // executeEdits preserves undo/redo; setValue clears the stack. Reindex/reload syncs
    // request a stack reset via the one-shot flag so translation indexing writes can never
    // be reverted with Cmd+Z (matching the visual editor, which clears undo on reload).
    if (window.__leafWriterNextSourceSyncResetsUndo) {
      window.__leafWriterNextSourceSyncResetsUndo = false;
      model.setValue(value);
    } else {
      editor.executeEdits('external-sync', [
        { range: model.getFullModelRange(), text: value, forceMoveMarkers: true },
      ]);
    }
    lastEditorValueRef.current = value;
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    monaco.editor.setModelMarkers(model, 'leafwriter-validation', markers ?? []);
  }, [editor, markers]);

  useEffect(() => {
    decorations?.clear();

    if (!editor || !errorPositions?.length) return;

    const nextDecorations = editor.createDecorationsCollection(
      errorPositions.map((pos) => ({
        range: new monaco.Range(pos.line, 0, pos.line, pos.col),
        options: {
          className: 'monaco-editor-error-line',
          isWholeLine: true,
          minimap: {
            color: 'rgba(255, 0, 0, 0.2)',
            position: 1,
          },
        },
      })),
    );

    setDecorations(nextDecorations);
  }, [editor, errorPositions]);

  return (
    <Box
      className="Editor"
      ref={divEl}
      sx={{ height: '100%', minHeight, width: '100%' }}
    />
  );
};
