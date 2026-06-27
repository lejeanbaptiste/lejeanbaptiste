import { useEffect } from 'react';
import { useActions, useAppState } from '../../overmind';
import { XmlMonacoEditor } from './XmlMonacoEditor';

export const SourceEditorPane = () => {
  const { sourceCurrentContent } = useAppState().ui;
  const { setSourceCurrentContent } = useActions().ui;

  useEffect(() => {
    window.writer?.layoutManager?.resizeSourceEditor();
    const timer = setTimeout(() => window.writer?.layoutManager?.resizeSourceEditor(), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <XmlMonacoEditor
      value={sourceCurrentContent}
      onChange={setSourceCurrentContent}
    />
  );
};
