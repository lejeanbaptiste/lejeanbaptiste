import { CssBaseline, ThemeProvider } from '@mui/material';
import MessageDialog from '@src/components/MessageDialog';
import Storage from '@src/components/Storage';
import { SnackbarProvider } from 'notistack';
import React, { useEffect, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoutes } from 'react-router-dom';
import AlertDialog from './components/AlertDialog';
import { useTracking } from './hooks/useTracking';
import { useAppState } from './overmind';
import routes from './routes';
import theme from './theme';

const App: FC = () => {
  const { darkMode, language } = useAppState().ui;

  const routing = useRoutes(routes);
  const { i18n } = useTranslation();

  //@ts-ignore
  useTracking(process.env.GA_MEASUREMENT_ID);

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
