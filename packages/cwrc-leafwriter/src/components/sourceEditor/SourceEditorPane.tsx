import { useCallback, useEffect, useMemo } from 'react';
import { useActions, useAppState } from '../../overmind';
import { setCursorOffsetInSourceEditor } from '../../sourceEditor/findInSourceEditor';
import { XmlMonacoEditor } from './XmlMonacoEditor';
import { useSourceValidation } from './useSourceValidation';

export const SourceEditorPane = () => {
  const { editorViewMode, sourceCurrentContent, sourcePendingCursorOffset } = useAppState().ui;
  const { resource } = useAppState().editor;
  const { clearSourcePendingCursorOffset, setSourceCurrentContent } = useActions().ui;
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

  const applyPendingCursor = useCallback(() => {
    if (sourcePendingCursorOffset === null) return true;

    const applied = setCursorOffsetInSourceEditor({
      offset: sourcePendingCursorOffset,
      focusEditor: true,
    });
    if (applied) {
      clearSourcePendingCursorOffset();
    }
    return applied;
  }, [clearSourcePendingCursorOffset, sourcePendingCursorOffset]);

  useEffect(() => {
    window.writer?.layoutManager?.resizeSourceEditor();
    const timer = setTimeout(() => window.writer?.layoutManager?.resizeSourceEditor(), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (editorViewMode !== 'source' || sourcePendingCursorOffset === null) return;

    if (applyPendingCursor()) return;

    const timers = [0, 50, 150, 350].map((delay) =>
      setTimeout(() => {
        applyPendingCursor();
      }, delay),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [applyPendingCursor, editorViewMode, sourceCurrentContent, sourcePendingCursorOffset]);

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
