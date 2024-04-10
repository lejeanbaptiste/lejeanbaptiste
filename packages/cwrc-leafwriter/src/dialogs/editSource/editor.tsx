import { useTheme } from '@mui/material';
import { useSetAtom } from 'jotai';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useRef, useState } from 'react';
import type { EditSourceDialogProps } from '../type';
import { useEditor } from './hooks/useEditor';
import { contentTypeAtom, currentContentAtom, originalContentAtom } from './store';

// * Intellisense for XML: https://mono.software/2017/04/11/custom-intellisense-with-monaco-editor/

// @ts-ignore
// self.MonacoEnvironment = {
//   getWorkerUrl: function (_moduleId: any, label: string) {
//     return './editor.worker.bundle.js';
//   },
// };

interface EditorProps {
  initialContent: string;
  type: EditSourceDialogProps['type'];
}

export const Editor = ({ initialContent, type }: EditorProps) => {
  const { palette } = useTheme();
  const setCurrentContent = useSetAtom(currentContentAtom);
  const setOriginalContent = useSetAtom(originalContentAtom);
  const setType = useSetAtom(contentTypeAtom);

  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const divEl = useRef<HTMLDivElement>(null);

  useEditor(editor);

  useEffect(() => {
    setOriginalContent(initialContent);
    setType(type);

    if (divEl.current) {
      setCurrentContent(initialContent);
      const monacoEditor = monaco.editor.create(divEl.current, {
        lineNumbers: 'on',
        language: 'xml',
        theme: palette.mode === 'dark' ? 'vs-dark' : 'vs-light',
        value: initialContent,
        wordWrap: 'wordWrapColumn',
        wordWrapColumn: 100,
        wrappingIndent: 'indent',
      });

      monacoEditor.getModel()?.onDidChangeContent(() => {
        const content = monacoEditor.getValue();
        setCurrentContent(content);
      });

      setEditor(monacoEditor);
    }

    return () => {
      editor?.dispose();
    };
  }, []);

  return <div className="Editor" ref={divEl} style={{ minHeight: 600 }} />;
};
