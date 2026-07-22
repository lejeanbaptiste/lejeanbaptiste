import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import ModalProvider from 'mui-modal-provider';
import { SnackbarProvider } from 'notistack';
import { useEffect } from 'react';
import App from './App';
import { useActions, useAppState } from './overmind';
import theme from './theme';
import type { LeafWriterOptions } from './types';

/**
 * ThemeProvider's `defaultMode` only seeds MUI's CSS-variable color scheme
 * once at mount. Panels that use `theme.applyStyles('dark', …)` need this
 * sync or they keep their light `#f5f5f5` backgrounds in dark mode.
 */
const SyncColorScheme = ({ darkMode }: { darkMode: boolean }) => {
  const { setMode } = useColorScheme();
  useEffect(() => {
    setMode(darkMode ? 'dark' : 'light');
  }, [darkMode, setMode]);
  return null;
};

const Providers = (props: LeafWriterOptions) => {
  const { setDarkMode } = useActions().ui;
  const { darkMode, themeAppearance } = useAppState().ui;

  const preferDark = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    if (themeAppearance === 'system') setDarkMode(preferDark);
  }, [preferDark, setDarkMode, themeAppearance]);

  return (
    <ThemeProvider theme={theme} defaultMode={darkMode ? 'dark' : 'light'}>
      <SyncColorScheme darkMode={darkMode} />
      <CssBaseline enableColorScheme />
      <ModalProvider>
        <SnackbarProvider autoHideDuration={5000} disableWindowBlurListener>
          <App {...props} />
        </SnackbarProvider>
      </ModalProvider>
    </ThemeProvider>
  );
};

export default Providers;
