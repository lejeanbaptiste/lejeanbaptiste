import { Box, useTheme } from '@mui/material';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useMemo, useRef, useState } from 'react';

// * Intellisense for XML: https://mono.software/2017/04/11/custom-intellisense-with-monaco-editor/

// @ts-ignore
// self.MonacoEnvironment = {
//   getWorkerUrl: function (_moduleId: any, label: string) {
//     return './editor.worker.bundle.js';
//   },
// };

interface EditorProps {
  showLOD: boolean;
}

type UpdateProps = {
  useDoc: boolean;
};

export const Editor = ({ showLOD }: EditorProps) => {
  const { palette } = useTheme();
  const { writer } = window;

  const divEl = useRef<HTMLDivElement>(null);

  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [showingFullDocument, setShowingFullDocument] = useState(false);
  const [content, setContent] = useState('');
  const [update, setUpdate] = useState<UpdateProps | null>(null);
  const [_showLOD, _setShowLOD] = useState(showLOD);

  const editorTheme = useMemo(
    () => (palette.mode === 'dark' ? 'vs-dark' : 'vs-light'),
    [palette.mode],
  );

  useEffect(() => {
    const parentContainer = document.getElementById('code-panel');
    if (parentContainer) resizeObserver.observe(parentContainer);

    if (divEl.current) {
      const _editor = monaco.editor.create(divEl.current, {
        automaticLayout: true,
        fontSize: 10,
        lineNumbers: 'off',
        language: 'xml',
        minimap: { enabled: false },
        readOnly: true,
        theme: editorTheme,
        value: content,
        wordWrap: 'bounded',
        wordWrapColumn: 100,
        wrappingIndent: 'indent',
      });

      setEditor(_editor);
    }

    writer.event('documentLoaded').subscribe(() => triggerFromEvent('documentLoaded'));
    writer.event('selectionChanged').subscribe(() => triggerFromEvent('selectionChanged'));
    writer.event('contentChanged').subscribe(() => triggerFromEvent('contentChanged'));
    // writer.event('nodeChanged').subscribe(() => triggerFromEvent('nodeChanged'));
    writer.event('tagSelected').subscribe(() => triggerFromEvent('tagSelected'));
    writer.event('tagAdded').subscribe(() => triggerFromEvent('tagAdded'));
    writer.event('tagEdited').subscribe(() => triggerFromEvent('tagEdited'));
    writer.event('tagRemoved').subscribe(() => triggerFromEvent('tagRemoved'));
    writer.event('massUpdateStarted').subscribe(() => triggerFromEvent('massUpdateStarted'));
    writer.event('massUpdateCompleted').subscribe(() => triggerFromEvent('massUpdateCompleted'));

    return () => {
      editor?.dispose();
      setEditor(null);

      writer.event('documentLoaded').unsubscribe(() => triggerFromEvent('documentLoaded'));
      writer.event('selectionChanged').unsubscribe(() => triggerFromEvent('selectionChanged'));
      writer.event('contentChanged').unsubscribe(() => triggerFromEvent('contentChanged'));
      // writer.event('nodeChanged').unsubscribe(() => triggerFromEvent('nodeChanged'));
      writer.event('tagSelected').unsubscribe(() => triggerFromEvent('tagSelected'));
      writer.event('tagAdded').unsubscribe(() => triggerFromEvent('tagAdded'));
      writer.event('tagEdited').unsubscribe(() => triggerFromEvent('tagEdited'));
      writer.event('tagRemoved').unsubscribe(() => triggerFromEvent('tagRemoved'));
      writer.event('massUpdateStarted').unsubscribe(() => triggerFromEvent('massUpdateStarted'));
      writer
        .event('massUpdateCompleted')
        .unsubscribe(() => triggerFromEvent('massUpdateCompleted'));
    };
  }, []);

  const triggerFromEvent = (eventName: string) => {
    if (eventName === 'documentLoaded') setUpdate({ useDoc: true });
    if (eventName === 'selectionChanged') {
      const isCollapsed = writer.editor?.selection.isCollapsed();
      isCollapsed ? setUpdate({ useDoc: true }) : setUpdate({ useDoc: false });
    }
    if (eventName === 'contentChanged') setUpdate({ useDoc: true });
    if (eventName === 'nodeChanged') !showingFullDocument && setUpdate({ useDoc: true });
    if (eventName === 'tagSelected') setUpdate({ useDoc: false });
    if (eventName === 'tagAdded') setUpdate({ useDoc: true });
    if (eventName === 'tagEdited') setUpdate({ useDoc: true });
    if (eventName === 'tagRemoved') setUpdate({ useDoc: true });
    if (eventName === 'massUpdateStarted') setEnabled(false);
    if (eventName === 'massUpdateCompleted') setEnabled(true);
  };

  useEffect(() => {
    if (update) {
      updateView(update.useDoc);
      setUpdate(null);
    }
  }, [update]);

  useEffect(() => {
    _setShowLOD(showLOD);
  }, [showLOD]);

  useEffect(() => {
    if (editor) updateView();
  }, [_showLOD]);

  useEffect(() => {
    editor?.setValue(content);
  }, [content]);

  useEffect(() => {
    editor?.updateOptions({ theme: editorTheme });
  }, [palette.mode]);

  const updateView = async (useDoc: boolean = false) => {
    if (!enabled) return;

    if (useDoc || writer.editor?.selection.isCollapsed()) {
      const content = await writer.converter.getDocumentContent(_showLOD);
      if (!content) return;

      setShowingFullDocument(true);
      setContent(content);
      return;
    }

    const range = writer.editor?.selection.getRng();
    const contents = range?.cloneContents();
    if (!contents) return;

    const content = writer.converter.buildXMLString(contents);

    setContent(content);
    setShowingFullDocument(false);
  };

  const resizeObserver = new ResizeObserver((entries) => {
    if (!divEl.current) return;
    if (!entries[0]) return;

    divEl.current.style.height = `${entries[0].contentRect.height - 36}px`;
  });

  return <Box className="Editor" ref={divEl} />;
};
