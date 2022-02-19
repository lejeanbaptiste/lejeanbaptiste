import { CssBaseline, ThemeProvider } from '@mui/material';
import MessageDialog from '@src/components/MessageDialog';
import Storage from '@src/components/Storage';
import React, { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoutes } from 'react-router-dom';
import { useTracking } from './hooks/tracking';
import { useAppState } from './overmind';
import routes from './routes';
import theme from './theme';
import { SnackbarProvider } from 'notistack';

const App: FC = () => {
  useTracking(process.env.GA_MEASUREMENT_ID);
  const routing = useRoutes(routes);
  const { darkMode, language } = useAppState();
  const { i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(language.code);
  }, [language]);

  return (
    <ThemeProvider theme={theme(darkMode)}>
      <SnackbarProvider>
        <CssBaseline enableColorScheme />
        <Storage />
        <MessageDialog />
        {routing}
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;
