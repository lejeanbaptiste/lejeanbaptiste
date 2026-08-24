import { useAtomValue } from 'jotai';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useState } from 'react';
import { xmlValidityAtom } from '../store';

export const useEditor = (editor: monaco.editor.IStandaloneCodeEditor | null) => {
  const xmlValidity = useAtomValue(xmlValidityAtom);

  const [decorations, setDecorations] = useState<
    monaco.editor.IEditorDecorationsCollection | undefined
  >(undefined);

  useEffect(() => {
    updateDecorations();
    // Deliberately keyed to a computed value: decorations only need rebuilding
    // when validity flips or the message text changes, not on every object
    // identity change. `updateDecorations` is redefined every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmlValidity.valid || xmlValidity.error.message]);

  const updateDecorations = () => {
    decorations?.clear();

    if (xmlValidity.valid || !xmlValidity.error.positions) return;

    const _decorations = editor?.createDecorationsCollection(
      xmlValidity.error.positions.map((pos) => {
        return {
          range: new monaco.Range(pos.line, 0, pos.line, pos.col),
          options: {
            className: 'monaco-editor-error-line',
            isWholeLine: true,
            minimap: {
              color: 'rgba(255, 0, 0, 0.2)',
              position: 1,
            },
          },
        };
      }),
    );

    setDecorations(_decorations);
  };

  return {
    updateDecorations,
  };
};
