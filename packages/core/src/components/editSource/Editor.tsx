import { useTheme } from '@mui/material';
// import * as monaco from 'monaco-editor';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import React, { FC, useEffect, useRef } from 'react';

// * Intellisense for XML: https://mono.software/2017/04/11/custom-intellisense-with-monaco-editor/

// @ts-ignore
// self.MonacoEnvironment = {
//   getWorkerUrl: function (_moduleId: any, label: string) {
//     return './editor.worker.bundle.js';
//   },
// };

interface IEditor {
  content: string;
  updateContent: (value: string) => void;
}

const Editor: FC<IEditor> = ({ content, updateContent }) => {
  const { palette } = useTheme();
  const divEl = useRef<HTMLDivElement>(null);
  let editor: monaco.editor.IStandaloneCodeEditor;

  useEffect(() => {
    if (divEl.current) {
      editor = monaco.editor.create(divEl.current, {
        lineNumbers: 'on',
        language: 'xml',
        // minimap: { enabled: false },
        theme: palette.mode === 'dark' ? 'vs-dark' : 'vs-light',
        value: content,
        wordWrap: 'wordWrapColumn',
        wordWrapColumn: 100,
        wrappingIndent: 'indent',
      });

      editor.getModel()?.onDidChangeContent(() => {
        const content = editor.getValue();
        updateContent(content);
      });
    }

    return () => {
      editor.dispose();
    };
  }, []);

  return <div className="Editor" style={{ minHeight: 600 }} ref={divEl} />;
};

export default Editor;
