import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { Storage } from '@src/components';
import ModalProvider from 'mui-modal-provider';
import { SnackbarProvider } from 'notistack';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useRoutes } from 'react-router-dom';
import { useAnalytics, useCookieConsent, usePermalink } from './hooks';
import { useActions, useAppState } from './overmind';
import { routes } from './routes';
import { theme } from './theme';

export const App = () => {
  const { cookieConsent, darkMode, language, themeAppearance } = useAppState().ui;
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
    i18n.changeLanguage(language.code);
  }, [language]);

  useEffect(() => {
    if (themeAppearance === 'auto') setDarkMode(prefersDarkMode);
  }, [prefersDarkMode]);

  return (
    <ThemeProvider theme={theme(darkMode)}>
      <ModalProvider>
        <SnackbarProvider>
          <CssBaseline enableColorScheme />
          {storageDialogState.open && <Storage />}
          {routing}
        </SnackbarProvider>
      </ModalProvider>
    </ThemeProvider>
  );
};

export default App;
