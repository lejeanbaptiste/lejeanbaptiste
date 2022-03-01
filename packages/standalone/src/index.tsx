import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React from 'react';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './i18n';
import { config } from './overmind';

const overmind = createOvermind(config, {
  name: 'homepage',
  devtools: true, // defaults to 'localhost:3031'
  logProxies: true,
});

render(
  <Provider value={overmind}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>,
  document.querySelector('#app')
);

// if (module.hot) module.hot.accept();
