import { useAtomValue, useSetAtom } from 'jotai';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useMemo, useState } from 'react';
import { XmlMonacoEditor } from '../../components/sourceEditor/XmlMonacoEditor';
import type { EditSourceDialogProps } from '../type';
import { useEditor } from './hooks/useEditor';
import { contentTypeAtom, currentContentAtom, originalContentAtom, xmlValidityAtom } from './store';

interface EditorProps {
  initialContent: string;
  type: EditSourceDialogProps['type'];
}

export const Editor = ({ initialContent, type }: EditorProps) => {
  const currentContent = useAtomValue(currentContentAtom);
  const setCurrentContent = useSetAtom(currentContentAtom);
  const setOriginalContent = useSetAtom(originalContentAtom);
  const setType = useSetAtom(contentTypeAtom);
  const xmlValidity = useAtomValue(xmlValidityAtom);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const lspOptions = useMemo(() => {
    const bridge = (
      window as Window & {
        __ljbLspProject?: { defaultSchemaRng?: string; projectRoot?: string };
      }
    ).__ljbLspProject;

    return {
      defaultSchemaRng: bridge?.defaultSchemaRng,
      projectRoot: bridge?.projectRoot,
    };
  }, []);

  const documentPath = useMemo(() => {
    const resourcePath = window.writer?.overmindState?.editor?.resource?.filePath;
    return resourcePath ?? null;
  }, []);

  useEditor(editor);

  useEffect(() => {
    setOriginalContent(initialContent);
    setType(type);
    setCurrentContent(initialContent);
  }, [initialContent, setCurrentContent, setOriginalContent, setType, type]);

  const errorPositions =
    xmlValidity.valid || !xmlValidity.error.positions ? undefined : xmlValidity.error.positions;

  return (
    <XmlMonacoEditor
      value={currentContent}
      onChange={setCurrentContent}
      onEditorInstance={setEditor}
      errorPositions={errorPositions}
      minHeight={600}
      documentPath={documentPath}
      lspOptions={lspOptions}
    />
  );
};
