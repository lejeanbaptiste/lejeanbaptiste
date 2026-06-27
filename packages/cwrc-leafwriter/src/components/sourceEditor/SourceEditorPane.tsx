import { useEffect } from 'react';
import { useActions, useAppState } from '../../overmind';
import { XmlMonacoEditor } from './XmlMonacoEditor';
import { useSourceValidation } from './useSourceValidation';

export const SourceEditorPane = () => {
  const { sourceCurrentContent } = useAppState().ui;
  const { setSourceCurrentContent } = useActions().ui;
  const { markers } = useSourceValidation();

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
    />
  );
};
