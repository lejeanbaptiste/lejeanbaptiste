// import { scan } from 'react-scan';

import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
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

// A webpack watch rebuild can briefly leave the page with an old lazy-chunk
// name while the new asset is being written. Reload once so the page obtains
// the current app manifest instead of leaving the desktop renderer broken.
if (typeof window !== 'undefined') {
  const reloadKey = 'leafwriter:chunk-reload';
  const isChunkLoadFailure = (value: unknown): boolean => {
    const message = value instanceof Error ? value.message : String(value);
    return message.includes('ChunkLoadError') || message.includes('Loading chunk');
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadFailure(event.reason)) return;
    if (sessionStorage.getItem(reloadKey) === '1') {
      sessionStorage.removeItem(reloadKey);
      return;
    }
    sessionStorage.setItem(reloadKey, '1');
    window.setTimeout(() => window.location.reload(), 100);
  });
  window.setTimeout(() => sessionStorage.removeItem(reloadKey), 5000);
}

const isNativeDialogRoute =
  typeof window !== 'undefined' && window.location.pathname.startsWith('/project/native/');

// Overmind attempts to connect to localhost:3031 as soon as this option is
// enabled. Keep the production and desktop console clean unless the developer
// explicitly asks for the inspector with `?overmindDevtools=1`.
const enableOvermindDevtools =
  !isNativeDialogRoute &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('overmindDevtools') === '1';

const overmind = createOvermind(config, {
  name: isNativeDialogRoute ? 'Commons-NativeDialog' : 'Commons',
  devtools: enableOvermindDevtools,
  logProxies: enableOvermindDevtools,
});

const container = document.getElementById('app');
if (!container) throw new Error(`HTML element id 'app' not found`);

const root = createRoot(container);

root.render(
  <Provider value={overmind}>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </Provider>,
);
