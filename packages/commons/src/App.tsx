import { CssBaseline, ThemeProvider } from '@mui/material';
import MessageDialog from '@src/components/MessageDialog';
import { Storage } from '@src/components';
import { SnackbarProvider } from 'notistack';
import React, { useEffect, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useRoutes } from 'react-router-dom';
import { analytics, initAnalytics } from './analytics';
import AlertDialog from './components/AlertDialog';
import { useActions, useAppState } from './overmind';
import routes from './routes';
import theme from './theme';

const App: FC = () => {
  const { getGAID } = useActions().ui;
  const { darkMode, language } = useAppState().ui;
  const location = useLocation();

  const routing = useRoutes(routes);
  const { i18n } = useTranslation();

  useEffect(() => {
    setupAnalytics();
  }, []);

  const setupAnalytics = async () => {
    const analytics = await initAnalytics(getGAID);
    analytics.page();
  };

  useEffect(() => {
    if (analytics) analytics.page();
  }, [location.pathname, location.search]);

  useEffect(() => {
    i18n.changeLanguage(language.code);
  }, [language]);

  return (
      <ThemeProvider theme={theme(darkMode)}>
        <SnackbarProvider>
          <CssBaseline enableColorScheme />
          <Storage />
          <MessageDialog />
          <AlertDialog />
          {routing}
        </SnackbarProvider>
      </ThemeProvider>
  );
};

export default App;
