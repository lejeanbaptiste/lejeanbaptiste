import { derived } from 'overmind';
import type { Schema, SchemaMappingType } from '../../types';

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
  latestEvent?: string;
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
};
