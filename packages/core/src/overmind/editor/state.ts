import { derived } from 'overmind';
import type { ILookups } from '../../components/entityLookups/types';
import type { Schema } from '../../types';

type State = {
  advancedSettings: boolean;
  allowOverlap: boolean;
  annotationMode: number;
  annotationModeLabel: string;
  annotationModes: {
    value: number;
    label: string;
    disabled?: boolean;
  }[];
  baseUrl?: string,
  currentFontSize: number;
  editorMode: string;
  editorModeLabel: string;
  editorModes: {
    key: number;
    value: string;
    label: string;
  }[];
  fontSizeOptions: number[];
  isAnnotator: boolean;
  isEditorDirty: boolean;
  isReadonly: boolean;
  mode: number;
  nssiToken?: string | (() => Promise<string | undefined>);
  schemas: Schema[];
  proxyLoaderXmlEndpoint?: string;
  proxyLoaderCssEndpoint?: string;
  settings?: any;
  showEntities: boolean;
  showTags: boolean;

  lookups: ILookups;
};

export const state: State = {
  advancedSettings: true,
  allowOverlap: false,
  annotationMode: 3,
  annotationModes: [
    { value: 1, label: 'RDF/XML', disabled: true },
    { value: 3, label: 'JSON-LD' },
  ],
  annotationModeLabel: derived((state: State) => {
    const annotatonMode = state.annotationModes.find((mode) => mode.value === state.annotationMode);
    if (!annotatonMode) return '';
    return annotatonMode.label;
  }),
  baseUrl: '.',
  currentFontSize: 11,
  editorMode: 'xmlrdf',
  editorModeLabel: derived((state: State) => {
    const editMode = state.editorModes.find((mode) => mode.value === state.editorMode);
    if (!editMode) return '';
    return editMode.label;
  }),
  editorModes: [
    { key: 1, value: 'xml', label: 'XML only (no overlap)' },
    { key: 0, value: 'xmlrdf', label: 'XML and RDF (no overlap)' },
    { key: 0, value: 'xmlrdfoverlap', label: 'XML and RDF (overlapping entities)' },
    { key: 2, value: 'rdf', label: 'RDF only' },
  ],
  fontSizeOptions: [8, 9, 10, 11, 12, 13, 14, 16, 18],
  isEditorDirty: false,
  isAnnotator: false,
  isReadonly: false,
  mode: 0,
  showEntities: true,
  showTags: false,
  schemas: [],

  lookups: {
    authorities: {
      viaf: {
        enabled: true,
        entities: {
          person: { enabled: true, name: 'person' },
          place: { enabled: true, name: 'place' },
          organization: { enabled: true, name: 'organization' },
          title: { enabled: true, name: 'title' },
          rs: { enabled: true, name: 'rs' },
        },
        id: 'viaf',
        name: 'VIAF',
        priority: 0,
      },

      wikidata: {
        enabled: true,
        entities: {
          person: { enabled: true, name: 'person' },
          place: { enabled: true, name: 'place' },
          organization: { enabled: true, name: 'organization' },
          title: { enabled: true, name: 'title' },
          rs: { enabled: true, name: 'rs' },
        },
        id: 'wikidata',
        name: 'Wikidata',
        priority: 1,
      },

      dbpedia: {
        enabled: true,
        entities: {
          person: { enabled: true, name: 'person' },
          place: { enabled: true, name: 'place' },
          organization: { enabled: true, name: 'organization' },
          title: { enabled: true, name: 'title' },
          rs: { enabled: true, name: 'rs' },
        },
        id: 'dbpedia',
        name: 'DBpedia',
        priority: 2,
      },

      getty: {
        enabled: true,
        entities: {
          person: { enabled: true, name: 'person' },
          place: { enabled: true, name: 'place' },
        },
        id: 'getty',
        name: 'Getty',
        priority: 3,
      },

      lgpn: {
        enabled: true,
        entities: { person: { enabled: true, name: 'person' } },
        id: 'lgpn',
        name: 'LGPN',
        priority: 4,
      },

      geonames: {
        enabled: false,
        entities: { place: { enabled: true, name: 'place' } },
        id: 'geonames',
        name: 'Geonames',
        priority: 5,
      },
    },

    serviceType: 'custom',
  },
};
