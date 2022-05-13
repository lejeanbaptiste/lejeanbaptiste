import { supportedSchemas } from './supportedSchemas';
import { NSSI_BASE_URL } from '../config/config';

export type EditorMode = 'rdf' | 'xml' | 'xml-rdf_overlap' | 'xml-rdf_nooverlap';

export const config = {
  editor: {
    settings: {
      validator: {
        autovalidates: true, // boolean
        autovalidatesInterval: 5000, // number<in miliseconds> -> 5 seconds
        recommendTagInsertion: 'speculative', // or 'speculative' | 'possible
      },
      editorMode: 'xml + rdf - no overlap', // 'rdf only' | 'xml only' | 'xml + rdf - overlap' | 'xml + rdf - no overlap'
      annotationMode: 'json-ld', // or 'rdf-xml' | 'json-ld'
      helpURL: 'https://cwrc.ca/CWRC-Writer_Documentation/', // string<url>
    },
    lookups: {
      service: {
        name: 'nssi',
        apiURL: NSSI_BASE_URL, //'https://keycloak.stage.lincsproject.ca',
      },
    },
    authentication: [{ name: 'nssi', service: {} }],
    providers: [{ name: 'github', service: {} }],
    schemas: {
      loader: {
        proxy: true, // boolean
        proxyURL: '/schema',
      },
      supportedSchemas,
    },
  },
  ui: {},
};

export type CwrcWriterConfig = typeof config;
