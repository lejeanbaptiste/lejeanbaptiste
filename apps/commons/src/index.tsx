// import { scan } from 'react-scan';

import './sentry-config';

import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import * as Sentry from '@sentry/react';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router';
import { useTranslation } from 'react-i18next';
import App from './App';
import './i18n';
import { config } from './overmind';
import './utilities/devtoolsLog';
import './utilities/log';

// scan({ enabled: true });

const isNativeDialogRoute =
  typeof window !== 'undefined' && window.location.pathname.startsWith('/project/native/');

const ErrorFallback = ({ error }: { error: unknown }) => {
  const { t } = useTranslation();
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>{t('LWC.error.something_went_wrong')}</h1>
      <p>{error instanceof Error ? error.message : t('LWC.error.unknown_error')}</p>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        {t('LWC.error.webpack_wait')}
      </p>
    </div>
  );
};

const overmind = createOvermind(config, {
  name: isNativeDialogRoute ? 'Commons-NativeDialog' : 'Commons',
  devtools: !isNativeDialogRoute,
  logProxies: !isNativeDialogRoute,
});

const container = document.getElementById('app');
if (!container) throw new Error(`HTML element id 'app' not found`);

const root = createRoot(container);

root.render(
  <Sentry.ErrorBoundary fallback={({ error }) => <ErrorFallback error={error} />}>
    <Provider value={overmind}>
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    </Provider>
  </Sentry.ErrorBoundary>,
);
