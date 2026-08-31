import { Box, useColorScheme } from '@mui/material';
import '../../monacoEnvironment';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';
import 'monaco-editor/esm/vs/editor/editor.main';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useMemo, useRef, useState } from 'react';

// * Intellisense for XML: https://mono.software/2017/04/11/custom-intellisense-with-monaco-editor/

/** Writer events the source panel mirrors. Subscribed and unsubscribed as one set. */
const WRITER_EVENTS = [
  'documentLoaded',
  'selectionChanged',
  'contentChanged',
  'tagSelected',
  'tagAdded',
  'tagEdited',
  'tagRemoved',
  'massUpdateStarted',
  'massUpdateCompleted',
] as const;

interface EditorProps {
  showLOD: boolean;
}

interface UpdateProps {
  useDoc: boolean;
}

export const Editor = ({ showLOD }: EditorProps) => {
  const { mode, systemMode } = useColorScheme();
  const { writer } = window;

  const divEl = useRef<HTMLDivElement>(null);

  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [showingFullDocument, setShowingFullDocument] = useState(false);
  const [content, setContent] = useState('');
  const [update, setUpdate] = useState<UpdateProps | null>(null);
  const [_showLOD, _setShowLOD] = useState(showLOD);

  const editorTheme = useMemo(
    () =>
      mode === 'dark' || (mode === 'system' && systemMode === 'dark') ? 'vs-dark' : 'vs-light',
    [mode, systemMode],
  );

  // Mount-only: creates the Monaco instance and subscribes to writer events.
  //
  // The teardown deliberately works off local bindings rather than component
  // state. With an empty dependency array the cleanup closes over the *initial*
  // `editor` state — null — so disposing that would silently never run; and the
  // handlers must be the same references `subscribe` was given, or `unsubscribe`
  // matches nothing. Both previously leaked on unmount; Editor.render.test.tsx
  // guards the dispose half.
  useEffect(() => {
    const parentContainer = document.getElementById('code-panel');
    if (parentContainer) resizeObserver.observe(parentContainer);

    let createdEditor: monaco.editor.IStandaloneCodeEditor | null = null;

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

      createdEditor = _editor;
      setEditor(_editor);
    }

    const handlers = WRITER_EVENTS.map((eventName) => {
      const handler = () => triggerFromEvent(eventName);
      writer.event(eventName).subscribe(handler);
      return [eventName, handler] as const;
    });

    return () => {
      createdEditor?.dispose();
      setEditor(null);

      for (const [eventName, handler] of handlers) {
        writer.event(eventName).unsubscribe(handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Keyed to the queued update. `updateView` is redefined every render, so
    // naming it would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

  useEffect(() => {
    _setShowLOD(showLOD);
  }, [showLOD]);

  useEffect(() => {
    if (editor) updateView();
    // Keyed to the level-of-detail toggle. `editor` is only read to check the
    // instance exists, and `updateView` is redefined every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_showLOD]);

  useEffect(() => {
    editor?.setValue(content);
    // Keyed to the content. The editor is created with this value already set, so
    // there is nothing to re-apply when the instance itself appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    editor?.updateOptions({ theme: editorTheme });
    // `editorTheme` is derived from exactly these two values, so listing them is
    // equivalent; `editor` is only read to check the instance exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, systemMode]);

  const updateView = async (useDoc = false) => {
    if (!enabled) return;
    // Source mode keeps the live XML in Monaco; TinyMCE is a stub — never export it.
    if (writer.overmindState?.ui?.editorViewMode === 'source') return;
    // Avoid converting while the editor is empty or mid-load — that spam-logs
    // "converter: no root found for TEI" on every selection/content event.
    if (!writer.isDocLoaded || !writer.editor) return;

    if (useDoc || writer.editor.selection.isCollapsed()) {
      let content: string | null | undefined;
      try {
        content = await writer.converter.getDocumentContent(_showLOD);
      } catch {
        return;
      }
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
