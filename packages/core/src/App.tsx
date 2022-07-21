import { Box, ThemeProvider, useMediaQuery } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import React, { useEffect, useState, type FC } from 'react';
import BottomBar from './components/bottombar';
import ContextMenu from './components/contextmenu';
import EditSourceDialog from './components/editSource';
import EntityLookupDialog from './components/entityLookups';
import Popup from './components/popup';
import SetingsDialog from './components/settings';
import { createConfig } from './config';
import Writer from './js/Writer';
import { useActions, useAppState } from './overmind';
import theme from './theme';
import type { ILeafWriterOptions } from './types';

import CssBaseline from '@mui/material/CssBaseline';
import ScopedCssBaseline from '@mui/material/ScopedCssBaseline';

declare global {
  interface Window {
    writer: Writer | null;
  }
}

const CONTAINER = 'lw-layout-container';

const App: FC<ILeafWriterOptions> = ({ document, settings, user }) => {
  const actions = useActions();
  const state = useAppState();
  const [writer, setWriter] = useState<Writer | null>(null);

  const preferDark = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    if (state.ui.themeAppearance === 'auto') actions.ui.setDarkMode(preferDark);
    return () => {};
  }, [preferDark]);

  useEffect(() => {
    if (document.url === undefined || state.document.url !== document.url) {
      if (writer) writer.destroy();
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
    <ThemeProvider theme={theme(state.ui.darkMode)}>
      <SnackbarProvider>
        <Box
          id={CONTAINER}
          sx={{
            height: 'calc(100% - 32px)',
            width: '100%',
          }}
        >
          {writer && <ContextMenu writer={writer} />}
        </Box>
        <BottomBar />
        <Popup />
        <EditSourceDialog />
        <EntityLookupDialog />
        <SetingsDialog />
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;
