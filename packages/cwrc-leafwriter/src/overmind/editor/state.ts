import { derived } from 'overmind';
import { lgpn } from '../lookups/services/lgpn';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type EditorStateType = {
  advancedSettings: boolean;
  allowOverlap: boolean;
  annotationMode: number;
  annotationModeLabel: string;
  annotationModes: {
    value: number;
    label: string;
    disabled?: boolean;
  }[];
  autosave?: boolean;
  baseUrl?: string;
  contentHasChanged: boolean;
  fontSize: number;
  editorMode: string;
  editorModeLabel: string;
  editorModes: {
    key: number;
    value: string;
    label: string;
    disabled?: boolean;
  }[];
  isAnnotator: boolean;
  isReadonly: boolean;
  LWChangeEventSuspended: boolean;
  mode: number;
  schemas: Record<string, Schema>;
  schemasList: Schema[];
  schemaMappings: SchemaMappingType[];
  proxyLoaderXmlEndpoint?: string;
  proxyLoaderCssEndpoint?: string;
  settings?: any;
  showEntities: boolean;
  showTags: boolean;
  latestEvent?: string;
  authorityServices: AuthorityServices;
};

export const state: EditorStateType = {
  advancedSettings: true,
  allowOverlap: false,
  annotationMode: 3,
  annotationModes: [
    { value: 1, label: 'RDF/XML', disabled: true },
    { value: 3, label: 'JSON-LD' },
  ],
  annotationModeLabel: derived((state: EditorStateType) => {
    const annotatonMode = state.annotationModes.find((mode) => mode.value === state.annotationMode);
    if (!annotatonMode) return '';
    return annotatonMode.label;
  }),
  baseUrl: '.',
  contentHasChanged: false,
  editorMode: 'xmlrdf',
  editorModeLabel: derived((state: EditorStateType) => {
    const editMode = state.editorModes.find((mode) => mode.value === state.editorMode);
    if (!editMode) return '';
    return editMode.label;
  }),
  editorModes: [
    { key: 1, value: 'xml', label: 'Markup only' },
    { key: 0, value: 'xmlrdf', label: 'Markup & Linking' },
    { key: 0, value: 'xmlrdfoverlap', label: 'Markup & Linking with overlap' },
    { key: 2, value: 'rdf', label: 'Linking Only', disabled: true },
  ],
  fontSize: 11,
  isAnnotator: false,
  isReadonly: false,
  LWChangeEventSuspended: false,
  mode: 0,
  showEntities: true,
  showTags: false,
  schemas: {},
  schemasList: derived((state: EditorStateType) => Object.values(state.schemas)),
  schemaMappings: ['cwrcEntry', 'orlando', 'tei', 'teiLite'],
  authorityServices: {
    viaf: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'viaf',
      name: 'VIAF',
      priority: 0,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    wikidata: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'wikidata',
      name: 'Wikidata',
      priority: 1,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    dbpedia: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'dbpedia',
      name: 'DBpedia',
      priority: 2,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    getty: {
      entities: { person: true, place: true },
      id: 'getty',
      name: 'Getty',
      priority: 3,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    geonames: {
      entities: { place: true },
      id: 'geonames',
      name: 'Geonames',
      priority: 4,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    lincs: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'lincs',
      name: 'Lincs',
      priority: 5,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    gnd: {
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      id: 'gnd',
      name: 'GND',
      priority: 6,
      serviceSource: 'LINCS',
      serviceType: 'API',
    },
    lgpn,
  },
};
