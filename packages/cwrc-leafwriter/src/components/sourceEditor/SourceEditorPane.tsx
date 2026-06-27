import { useEffect, useMemo } from 'react';
import { useActions, useAppState } from '../../overmind';
import { XmlMonacoEditor } from './XmlMonacoEditor';
import { useSourceValidation } from './useSourceValidation';

export const SourceEditorPane = () => {
  const { sourceCurrentContent } = useAppState().ui;
  const { resource } = useAppState().editor;
  const { setSourceCurrentContent } = useActions().ui;
  const { markers } = useSourceValidation();

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
  }, [resource?.filePath]);

  useEffect(() => {
    window.writer?.layoutManager?.resizeSourceEditor();
    const timer = setTimeout(() => window.writer?.layoutManager?.resizeSourceEditor(), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <XmlMonacoEditor
      value={sourceCurrentContent}
      onChange={setSourceCurrentContent}
      markers={markers}
      documentPath={resource?.filePath}
      lspOptions={lspOptions}
    />
  );
};
