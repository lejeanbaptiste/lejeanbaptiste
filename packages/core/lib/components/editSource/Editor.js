import { useTheme } from '@mui/material';
// import * as monaco from 'monaco-editor';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import React, { useEffect, useRef } from 'react';
const Editor = ({ content, updateContent }) => {
    const { palette } = useTheme();
    const divEl = useRef(null);
    let editor;
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
    return React.createElement("div", { className: "Editor", style: { minHeight: 600 }, ref: divEl });
};
export default Editor;
//# sourceMappingURL=Editor.js.map