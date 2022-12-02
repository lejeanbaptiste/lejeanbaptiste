import { OptionsObject, SnackbarMessage } from 'notistack';
import type { Bookmark, Editor } from 'tinymce/tinymce';
import type { LookupsConfig } from '../dialogs/entityLookups';
import Writer from '../js/Writer';

export type { Authority, LookupsProps } from '../dialogs/entityLookups';

export declare var webpackEnv: {
  LEAFWRITER_VERSION?: string;
  NODE_ENV: string;
  WORKER_ENV: string;
};

export interface LeafWriterOptions {
  document: LWDocument;
  preferences?: LeafWriterOptionsPreference;
  settings?: LeafWriterOptionsSettings;
  user?: User;
}

export interface LWDocument {
  url?: string;
  xml: string;
}

export interface LeafWriterOptionsPreference {
  fontSize?: number; // [Optional] Changes the document's default font size. Default: 11. Options: 10-18
  themeMode?: string; // [Optional] Use dark/light mode. Default: 'auto' (follows the system). Options: 'auto' | 'light' | 'dark'
  workspace?: {
    leftSide: string[]; // [Required] List of panel names. Default: ['structure', 'nerve']
    rightSide: string[]; // [Required] List of panel names. Default: ['xml-viewer', 'image-viewer', 'validator']
  };
}

export interface LeafWriterOptionsSettings {
  container?: string;

  baseUrl?: string;

  credentials?: {
    nssiToken?: string | (() => Promise<string | undefined>);
  };

  colorScheme?: string;
  language?: string;

  lookups?: LookupsConfig;
  schemas?: Schema[];
  schemasId?: SupportedSchemasId[];

  modules?: Object;
  services?: any;

  readonly?: boolean;
  annotator?: boolean;
  mode?: string;
  allowOverlap?: boolean;
  buttons1?: string[];
  buttons2?: string[];
  buttons3?: string[];
}

export type SupportedSchemasId =
  | 'cwrcTeiLite'
  | 'orlando'
  | 'event'
  | 'cwrcEntry'
  | 'epidoc'
  | 'teiAll'
  | 'teiDrama'
  | 'teiCorpus'
  | 'teiMs'
  | 'teiLite'
  | 'reed';

export type SupportedEntityLookups =
  | 'dbpedia'
  | 'geonames'
  | 'getty'
  | 'lgpn'
  | 'viaf'
  | 'wikidata'
  | 'cwrc';

export const SupportedSchemas: Map<string, Schema> = new Map();

export interface User {
  avatar_url?: string;
  email?: string;
  name: string;
  uri: string;
}

export const SchemaMappings = ['cwrcEntry', 'orlando', 'tei', 'teiLite'] as const;
export type SchemaMappingType = typeof SchemaMappings[number];

export interface Schema {
  id: string;
  name: string;
  mapping: SchemaMappingType;
  rng: string[];
  css: string[];
  editable?: boolean;
};

export interface Language {
  code: string;
  name: string;
  shortName: string;
}

export const Languages: Map<string, Language> = new Map();

export type ErrorType = 'info' | 'warning' | 'error';

export interface Error {
  type?: ErrorType;
  message: string;
}

//ENTITY
export enum EntityType {
  PERSON = 'person',
  PLACE = 'place',
  ORGANIZATION = 'organization',
  ORG = 'org',
  REFERENCING_STRING = 'referencing_string',
  RS = 'rs',
  TITLE = 'title',
  CITATION = 'citation',
  NOTE = 'note',
  DATE = 'date',
  CORRECTION = 'correction',
  KEYWORD = 'keyword',
  LINK = 'link',
}

//UI
export type PaletteMode = 'light' | 'auto' | 'dark';

export interface ContextMenuState {
  show: boolean;
  position?: {
    posX: number;
    posY: number;
  };
  eventSource?: string;
  tagId?: string | string[];
  useSelection?: boolean;
  allowsTagAround?: boolean;
  element?: HTMLElement | null;
  hasContentSelection?: boolean;
  isEntity?: boolean;
  isHeader?: boolean;
  isRoot?: boolean;
  isMultiple?: boolean;
  rng?: Range;
  tagName?: string | null;
}

//---------

export interface LeafWriterEditor extends Editor {
  writer?: Writer;
  currentBookmark?: Bookmark;
  currentNode?: Node | undefined;
  copiedElement?: {
    selectionType?: any;
    element?: Element | undefined;
  };
  copiedEntity?: any;
  lastKeyPress?: string;
}

export interface NotificationProps {
  dismissed?: boolean;
  key?: string | number;
  message: SnackbarMessage;
  options?: OptionsObject;
}

export interface ScreenshotParams {
  width?: number;
  height?: number;
  windowWidth?: number;
  windowHeight?: number;
}
