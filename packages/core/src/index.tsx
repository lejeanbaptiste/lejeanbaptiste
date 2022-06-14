import '@fontsource/lato/100.css';
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fortawesome/fontawesome-free/css/all.css';
// import '@fortawesome/fontawesome-free/webfonts/fa-regular-400.woff2';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import type { LeafWriterConfig } from './@types';
import App from './App';
import type { Authority, LookupsEntityType } from './components/entityLookups/types';
import i18next from './i18n';
import { config } from './overmind';
import type { ILeafWriterOptions, LWDocument } from './types';
import './utilities/log';

export * as Types from './types';

const overmind = createOvermind(config, {
  name: 'leafWriter',
  devtools: true,
  logProxies: true,
});

const Leafwriter: FC<LeafWriterConfig> = (props) => (
  <Provider value={overmind}>
    <I18nextProvider i18n={i18next}>
      <App {...props} />
    </I18nextProvider>
  </Provider>
);

export default Leafwriter;
