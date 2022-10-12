import { derived } from 'overmind';
import type { ILookups } from '../../dialogs/entityLookups';
import type { Schema, SchemaMappingType } from '../../types';

export type EditorStateType = {
  autosave?: boolean;
  advancedSettings: boolean;
  allowOverlap: boolean;
  annotationMode: number;
  annotationModeLabel: string;
  annotationModes: {
    value: number;
    label: string;
    disabled?: boolean;
  }[];
  baseUrl?: string;
  currentFontSize: number;
  editorMode: string;
  editorModeLabel: string;
  editorModes: {
    key: number;
    value: string;
    label: string;
    disabled?: boolean;
  }[];
  fontSizeOptions: number[];
  isAnnotator: boolean;
  isEditorDirty: boolean;
  isReadonly: boolean;
  mode: number;
  nssiToken?: string | (() => Promise<string | undefined>);
  schemas: { [key: string]: Schema };
  schemasList: Schema[];
  schemaMappings: SchemaMappingType[];
  proxyLoaderXmlEndpoint?: string;
  proxyLoaderCssEndpoint?: string;
  settings?: any;
  showEntities: boolean;
  showTags: boolean;

  latestEvent?: string;

  lookups: ILookups;
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
  currentFontSize: 11,
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
  fontSizeOptions: [8, 9, 10, 11, 12, 13, 14, 16, 18],
  isEditorDirty: false,
  isAnnotator: false,
  isReadonly: false,
  mode: 0,
  showEntities: true,
  showTags: false,
  schemas: {},
  schemasList: derived((state: EditorStateType) => Object.values(state.schemas)),
  schemaMappings: ['cwrcEntry', 'orlando', 'tei', 'teiLite'],

  lookups: {
    authorities: {
      viaf: {
        enabled: true,
        entities: { person: true, place: true, organization: true, title: true, rs: true },
        id: 'viaf',
        name: 'VIAF',
        priority: 0,
      },

      wikidata: {
        enabled: true,
        entities: { person: true, place: true, organization: true, title: true, rs: true },
        id: 'wikidata',
        name: 'Wikidata',
        priority: 1,
      },

      dbpedia: {
        enabled: true,
        entities: { person: true, place: true, organization: true, title: true, rs: true },
        id: 'dbpedia',
        name: 'DBpedia',
        priority: 2,
      },

      getty: {
        enabled: true,
        entities: { person: true, place: true },
        id: 'getty',
        name: 'Getty',
        priority: 3,
      },

      geonames: {
        enabled: false,
        entities: { place: true },
        id: 'geonames',
        name: 'Geonames',
        priority: 4,
        requireAuth: true,
      },

      lgpn: {
        enabled: false,
        entities: { person: false },
        id: 'lgpn',
        name: 'LGPN',
        priority: 5,
      },
    },

    serviceType: 'custom',
  },
};
