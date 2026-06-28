import { Box, useColorScheme } from '@mui/material';
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
import { registerLinkedTagEditing } from './linkedTagEditing';
import { registerPairedTagUnwrap } from './pairedTagUnwrap';
import { useXmlLanguageClient } from './useXmlLanguageClient';
import type { LspStartOptions } from './lsp/ipcLspClient';

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

    // executeEdits preserves undo/redo; setValue clears the stack.
    editor.executeEdits('external-sync', [
      { range: model.getFullModelRange(), text: value, forceMoveMarkers: true },
    ]);
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
