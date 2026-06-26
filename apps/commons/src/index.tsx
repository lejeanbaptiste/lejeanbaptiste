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
import App from './App';
import './i18n';
import { config } from './overmind';
import './utilities/devtoolsLog';
import './utilities/log';

// scan({ enabled: true });

const overmind = createOvermind(config, {
  name: 'Commons',
  devtools: true, // defaults to 'localhost:3031'
  logProxies: true,
});

const container = document.getElementById('app');
if (!container) throw new Error(`HTML element id 'app' not found`);

const root = createRoot(container);
const errorFallback = ({ error }: { error: unknown }) => (
  <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
    <h1>Something went wrong</h1>
    <p>{error instanceof Error ? error.message : 'An unknown error occurred.'}</p>
    <p style={{ color: '#666', fontSize: '0.9rem' }}>
      If you just started the desktop app, wait for webpack to finish compiling and reload the
      window.
    </p>
  </div>
);

root.render(
  <Sentry.ErrorBoundary fallback={errorFallback}>
    <Provider value={overmind}>
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    </Provider>
  </Sentry.ErrorBoundary>,
);
