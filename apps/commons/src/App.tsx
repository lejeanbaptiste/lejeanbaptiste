import { CssBaseline, useMediaQuery } from '@mui/material';
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import { Storage } from '@src/dialogs';
import { isDesktop } from '@src/types/desktop';
import ModalProvider from 'mui-modal-provider';
import { SnackbarProvider } from 'notistack';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useRoutes } from 'react-router';
import { useDesktopAppMenuBridge } from './desktop/useDesktopAppMenuBridge';
import { useAnalytics, useCookieConsent, usePermalink } from './hooks';
import { useActions, useAppState } from './overmind';
import { routes } from './routes';
import { theme } from './theme';

/**
 * `ThemeProvider`'s `defaultMode` prop only seeds MUI's CSS-variable color
 * scheme once, at mount — updating it on a later render is a no-op. Anything
 * reading mode via `useColorScheme()` (e.g. TabIcon's PNG selection) needs
 * this explicit sync to actually follow `darkMode` after the first render.
 */
const SyncColorScheme = ({ darkMode }: { darkMode: boolean }) => {
  const { setMode } = useColorScheme();
  useEffect(() => {
    setMode(darkMode ? 'dark' : 'light');
  }, [darkMode, setMode]);
  return null;
};

export const App = () => {
  useDesktopAppMenuBridge();
  const { cookieConsent, darkMode, currentLocale, themeAppearance } = useAppState().ui;
  const { storageDialogState } = useAppState().storage;

  const { setDarkMode, switchLanguage } = useActions().ui;

  const location = useLocation();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const routing = useRoutes(routes);
  const { i18n } = useTranslation();

  const { switchLanguage: switchLanguageConsent } = useCookieConsent();
  const { analytics, initAnalytics, stopAnalytics } = useAnalytics();
  const { getLanguage } = usePermalink();

  useEffect(() => {
    const language = getLanguage();
    if (language) {
      switchLanguage(language);
      switchLanguageConsent(language);
    }
  }, []);

  useEffect(() => {
    if (cookieConsent.includes('measurement')) initAnalytics();
    if (!cookieConsent.includes('measurement')) stopAnalytics();
  }, [cookieConsent]);

  useEffect(() => {
    if (analytics) analytics.page();
  }, [location.pathname, location.search]);

  useEffect(() => {
    i18n.changeLanguage(currentLocale);
  }, [currentLocale]);

  useEffect(() => {
    if (themeAppearance === 'system') setDarkMode(prefersDarkMode);
  }, [prefersDarkMode, themeAppearance]);

  // On Linux, Chromium's `prefers-color-scheme` media query does not reliably
  // live-update when the OS theme changes, so the desktop app also listens to
  // Electron's nativeTheme, which tracks OS theme changes through native APIs.
  useEffect(() => {
    if (!isDesktop() || themeAppearance !== 'system') return;
    const electronAPI = window.electronAPI;
    if (!electronAPI?.onNativeThemeChanged) return;

    electronAPI.getShouldUseDarkColors?.().then((shouldUseDarkColors) => {
      if (shouldUseDarkColors !== undefined) setDarkMode(shouldUseDarkColors);
    });

    return electronAPI.onNativeThemeChanged((shouldUseDarkColors) => {
      setDarkMode(shouldUseDarkColors);
    });
  }, [themeAppearance]);

  return (
    <ThemeProvider theme={theme} defaultMode={darkMode ? 'dark' : 'light'}>
      <SyncColorScheme darkMode={darkMode} />
      <ModalProvider>
        <SnackbarProvider autoHideDuration={5000} disableWindowBlurListener>
          <CssBaseline enableColorScheme />
          {storageDialogState.open && <Storage />}
          {routing}
        </SnackbarProvider>
      </ModalProvider>
    </ThemeProvider>
  );
};

export default App;
