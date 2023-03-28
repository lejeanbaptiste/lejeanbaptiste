import { ThemeProvider, useMediaQuery } from '@mui/material';
import ModalProvider from 'mui-modal-provider';
import { SnackbarProvider } from 'notistack';
import React, { useEffect } from 'react';
import App from './App';
import { useActions, useAppState } from './overmind';
import theme from './theme';
import type { LeafWriterOptions } from './types';

const Providers = (props: LeafWriterOptions) => {
  const { setDarkMode } = useActions().ui;
  const { darkMode, themeAppearance } = useAppState().ui;

  const preferDark = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    if (themeAppearance === 'auto') setDarkMode(preferDark);
  }, [preferDark]);

  return (
    <ThemeProvider theme={theme(darkMode)}>
      <ModalProvider>
        <SnackbarProvider>
          <App {...props} />
        </SnackbarProvider>
      </ModalProvider>
    </ThemeProvider>
  );
};

export default Providers;
