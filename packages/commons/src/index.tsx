import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import './utilities/devToolsConsole';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './i18n';
import { config } from './overmind';
import './utilities/log';

const overmind = createOvermind(config, {
  name: 'Commons',
  devtools: true, // defaults to 'localhost:3031'
  logProxies: true,
});

const container = document.getElementById('app');
if (!container) throw new Error(`HTML element id 'app' not found`);

const root = createRoot(container);
root.render(
  <Provider value={overmind}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>
);

// if (module.hot) module.hot.accept();
