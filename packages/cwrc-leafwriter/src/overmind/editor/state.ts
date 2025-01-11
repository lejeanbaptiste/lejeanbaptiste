import { derived } from 'overmind';
import type { AuthorityServices } from '../../dialogs/entityLookups';
import type { Schema, SchemaMappingType } from '../../types';
import {
  dbpediaFind,
  geonamesFind,
  gettyFind,
  lgpnFind,
  viafFind,
  wikidataFind,
  gndFind,
} from '../lookups/services';

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
  nssiToken?: string | (() => Promise<string | undefined>);
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
      enabled: true,
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      find: viafFind,
      id: 'viaf',
      name: 'VIAF',
      priority: 0,
      lookupService: 'internal',
    },
    wikidata: {
      enabled: true,
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      find: wikidataFind,
      id: 'wikidata',
      name: 'Wikidata',
      priority: 1,
      lookupService: 'internal',
    },
    dbpedia: {
      enabled: true,
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      find: dbpediaFind,
      id: 'dbpedia',
      name: 'DBpedia',
      priority: 2,
      lookupService: 'internal',
    },
    getty: {
      enabled: true,
      entities: { person: true, place: true },
      find: gettyFind,
      id: 'getty',
      name: 'Getty',
      priority: 3,
      lookupService: 'internal',
    },
    geonames: {
      enabled: false,
      entities: { place: true },
      find: geonamesFind,
      id: 'geonames',
      name: 'Geonames',
      priority: 4,
      requireAuth: true,
      lookupService: 'internal',
    },
    lgpn: {
      enabled: false,
      entities: { person: true },
      find: lgpnFind,
      id: 'lgpn',
      name: 'LGPN',
      priority: 5,
      lookupService: 'internal',
    },
    gnd: {
      enabled: true,
      entities: { person: true, place: true, organization: true, work: true, thing: true },
      find: gndFind,
      id: 'gnd',
      name: 'GND',
      priority: 5,
      lookupService: 'internal',
    },
  },
};
