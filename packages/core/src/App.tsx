import { Box } from '@mui/material';
import React, { useEffect, useState, type FC } from 'react';
import { BottomBar, ContextMenu } from './components';
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

const App: FC<LeafWriterOptions> = ({ document, settings, user }) => {
  const actions = useActions();
  const state = useAppState();
  const [writer, setWriter] = useState<Writer | null>(null);
  useDialog();
  useNotifier();

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
      </Box>
      <BottomBar />
    </>
  );
};

export default App;
