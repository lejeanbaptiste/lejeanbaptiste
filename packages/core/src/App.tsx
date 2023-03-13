import { Box } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BottomBar, ContextMenu, EditorToolbar } from './components';
import { createConfig } from './config';
import { EntityLookupDialog } from './dialogs';
import { useDialog, useNotifier } from './hooks';
import Writer from './js/Writer';
import { useActions, useAppState } from './overmind';
import type { LeafWriterOptions } from './types';

declare global {
  interface Window {
    writer: Writer | null;
  }
}

const CONTAINER = 'lw-layout-container';

const App = ({ document, settings, user }: LeafWriterOptions) => {
  const actions = useActions();
  const state = useAppState();
  const [writer, setWriter] = useState<Writer | null>(null);
  useDialog();
  useNotifier();

  const [editorToobarContainer, setEditorToobarContainer] = useState(null);

  useEffect(() => {
    if (document.url === undefined || state.document.url !== document.url) {
      // if (writer) writer.destroy();
      actions.document.setDocumentTouched(false);
      actions.document.setLoaded(false);
      window.writer = null;
      setWriter(null);
      setup();
    }
  }, [document]);

  useEffect(() => {
    window.document.addEventListener('fullscreenchange', fullscreenchanged);
    return () => {
      window.document.removeEventListener('fullscreenchange', fullscreenchanged);
    };
  }, []);

  useEffect(() => {
    actions.ui.updateReadonly();
  }, [state.editor.isReadonly]);

  const fullscreenchanged = () => actions.ui.setFullscreen(!!window.document.fullscreenElement);

  const setup = async () => {
    const config = createConfig(settings);
    const { credentials } = settings;

    config.container = CONTAINER;

    actions.document.clear();
    actions.editor.clear();

    actions.editor.writerInitSettings(config);

    if (credentials?.nssiToken) actions.editor.setNssiToken(credentials.nssiToken);

    actions.editor.initiateLookupSources(settings.lookups);

    actions.user.setUser(user);

    const _writer = new Writer(config);

    //@ts-ignore
    _writer.overmindState = state;
    //@ts-ignore
    _writer.overmindActions = actions;
    window.writer = _writer;

    //@ts-ignore
    _writer.event('writerInitialized').subscribe(() => {
      actions.document.setDocumentUrl(document.url);

      _writer.setDocument(document.xml);

      setWriter(window.writer);

      const toolbarContainer = window.document.querySelector('#editor-toolbar');
      setEditorToobarContainer(toolbarContainer);
      setTimeout(() => _writer.layoutManager.resizeEditor(), 50);
    });

    _writer.event('documentLoaded').subscribe((success: boolean) => {
      actions.document.setLoaded(true);
    });
  };

  return (
    <>
      <Box id={CONTAINER} sx={{ height: 'calc(100% - 32px)', width: '100%' }}>
        {writer && <ContextMenu writer={writer} />}
        <EntityLookupDialog />
        <div>
          {editorToobarContainer !== null && createPortal(<EditorToolbar />, editorToobarContainer)}
        </div>
      </Box>
      <BottomBar />
    </>
  );
};

export default App;
