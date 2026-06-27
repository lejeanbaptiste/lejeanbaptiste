import { Box, useColorScheme } from '@mui/material';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useRef, useState } from 'react';

export interface XmlMonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onEditorInstance?: (editor: monaco.editor.IStandaloneCodeEditor | null) => void;
  errorPositions?: { line: number; col: number }[];
  minHeight?: number | string;
}

export const XmlMonacoEditor = ({
  value,
  onChange,
  onEditorInstance,
  errorPositions,
  minHeight = 600,
}: XmlMonacoEditorProps) => {
  const { mode, systemMode } = useColorScheme();
  const divEl = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onEditorInstanceRef = useRef(onEditorInstance);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [decorations, setDecorations] = useState<
    monaco.editor.IEditorDecorationsCollection | undefined
  >(undefined);

  onChangeRef.current = onChange;
  onEditorInstanceRef.current = onEditorInstance;

  const isDarkMode = mode === 'dark' || (mode === 'system' && systemMode === 'dark');
  const theme = isDarkMode ? 'vs-dark' : 'vs-light';

  useEffect(() => {
    if (!divEl.current) return;

    const monacoEditor = monaco.editor.create(divEl.current, {
      automaticLayout: true,
      lineNumbers: 'on',
      language: 'xml',
      theme,
      value,
      wordWrap: 'wordWrapColumn',
      wordWrapColumn: 100,
      wrappingIndent: 'indent',
    });

    monacoEditor.getModel()?.onDidChangeContent(() => {
      onChangeRef.current(monacoEditor.getValue());
    });

    setEditor(monacoEditor);
    onEditorInstanceRef.current?.(monacoEditor);

    return () => {
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
    if (editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [editor, value]);

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
