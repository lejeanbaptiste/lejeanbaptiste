import { derived } from 'overmind';
import type { Schema, SchemaMappingType } from '../../types';
import { DEFAULT_ASIAN_FONT, DEFAULT_LATIN_FONT } from './fontFamilies';

export const DEFAULT_EDITOR_FONT_SIZE = 11;

export type ChoiceDisplayMode = 'original' | 'corrected' | 'both';

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
  asianFont: string;
  baseUrl?: string;
  /** Display mode for <choice>/<sic>/<corr>: show original text only, corrected text only, or both. */
  choiceDisplayMode: ChoiceDisplayMode;
  contentHasChanged: boolean;
  fontSize: number;
  latinFont: string;
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
  /** WYSIWYG only: block typing/paste/delete; tagging shortcuts still work. */
  textLocked: boolean;
  latestEvent?: string;
  LWChangeEventSuspended: boolean;
  mode: number;
  schemas: Record<string, Schema>;
  schemasList: Schema[];
  schemaMappings: SchemaMappingType[];
  proxyLoaderXmlEndpoint?: string;
  proxyLoaderCssEndpoint?: string;
  resource?: { filePath?: string | null };
  settings?: any;
  showEntities: boolean;
  showRawXmlPanel: boolean;
  showTagBubble: boolean;
  showTags: boolean;
  /** When false, hide <lb> and <pb> in the visual editor so interrupted text reads as one block. */
  showBreaks: boolean;
  /** Strip inter-character whitespace on load for no-space East Asian docs. */
  stripCjkWhitespace: boolean;
  /** Reject Find & Replace edits that would leave the document's XML not well-formed. */
  validateXmlOnReplace: boolean;
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
  asianFont: DEFAULT_ASIAN_FONT,
  baseUrl: '.',
  choiceDisplayMode: 'both',
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
    { key: 0, value: 'xmlrdfoverlap', label: 'Markup & Linking with overlap', disabled: true },
    { key: 2, value: 'rdf', label: 'Linking Only', disabled: true },
  ],
  fontSize: DEFAULT_EDITOR_FONT_SIZE,
  latinFont: DEFAULT_LATIN_FONT,
  isAnnotator: false,
  isReadonly: false,
  textLocked: false,
  LWChangeEventSuspended: false,
  mode: 0,
  showEntities: true,
  showRawXmlPanel: false,
  showTagBubble: true,
  showTags: false,
  showBreaks: true,
  stripCjkWhitespace: false,
  validateXmlOnReplace: true,
  schemas: {},
  schemasList: derived((state: EditorStateType) => Object.values(state.schemas)),
  schemaMappings: ['cwrcEntry', 'orlando', 'tei', 'teiLite'],
};
