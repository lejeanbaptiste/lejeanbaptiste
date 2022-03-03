import { Box, ThemeProvider, useMediaQuery } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import React, { FC, useEffect, useState } from 'react';
import type { LeafWriterConfig } from './@types';
import BottomBar from './components/bottombar';
import ContextMenu from './components/contextmenu';
import EditSourceDialog from './components/editSource';
import EntityLookupDialog from './components/entityLookups';
import Popup from './components/popup';
import TopBar from './components/topBar';
import { createConfigLegacy } from './config';
import Writer from './js/Writer';
import { useActions, useAppState } from './overmind';
import theme from './theme';

declare global {
  interface Window {
    writer: Writer | null;
  }
}

const CONTAINER = 'leafwriterContainer';

const App: FC<LeafWriterConfig> = ({ document, editor, onLoadRequest, onSaveRequest, user }) => {
  const actions = useActions();
  const state = useAppState();
  const [writer, setWriter] = useState<Writer | null>(null);

  const preferDark = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    if (state.ui.themeAppearance === 'auto') actions.ui.setDarkMode(preferDark);
    return () => {};
  }, [preferDark]);

  useEffect(() => {
    if (state.document.url !== document.url) {
      if (writer) writer.destroy();
      window.writer = null;
      setWriter(null);
      setup();
    }
  }, [document]);

  const setup = async () => {
    const config = createConfigLegacy({ document, editor, user });
    const { credentials } = editor;

    config.container = CONTAINER;
    if (onLoadRequest) config.onLoadRequest = onLoadRequest;
    if (onSaveRequest) config.onSaveRequest = onSaveRequest;

    actions.document.clear();
    actions.editor.clear();

    actions.editor.writerInitSettings(config);
   
    if (credentials?.nssiToken) actions.editor.setNssiToken(credentials?.nssiToken);

    actions.editor.initiateLookupSources(editor.lookups);

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
      if (document.file) actions.document.setResource(document.file);

      _writer.setDocument(document.xml);

      setWriter(window.writer);
    });
  };

  return (
    <ThemeProvider theme={theme(state.ui.darkMode)}>
      <SnackbarProvider>
        {/* <CssBaseline /> */}
        <TopBar />
        <Box
          id={CONTAINER}
          sx={{
            position: 'absolute',
            height: 'calc(100vh - 48px - 32px)',
            width: '100vw',
            top: '48px',
            paddingTop: '8px',
            backgroundColor: '#f5f5f5',
          }}
        />
        {writer && <ContextMenu writer={writer} />}
        <BottomBar />
        <Popup />
        <EditSourceDialog />
        <EntityLookupDialog />
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;
