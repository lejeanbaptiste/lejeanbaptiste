import type { Bookmark, Editor } from 'tinymce/tinymce';
import type { ILookupsConfig } from '../components/entityLookups/types';
import Writer from '../js/Writer';

export type { Authority, ILookupsConfig } from '../components/entityLookups/types';

export declare var webpackEnv: {
  LEAFWRITER_VERSION?: string;
  NODE_ENV: string;
  WORKER_ENV: string;
};

export interface ILeafWriterOptions {
  document: LWDocument;
  settings?: {
    credentials?: {
      nssiToken?: string | (() => Promise<string | undefined>);
    };
    colorScheme?: string;
    language?: string;
    legacy?: ConfigLegacy;
    lookups?: ILookupsConfig;
    schemas?: [SupportedSchemasId | Schema];
  };
  user?: User;
  preferences?: {
    fontSize?: number; // [Optional] Changes the document's default font size. Default: 11. Options: 10-18
    themeMode?: string; // [Optional] Use dark/light mode. Default: 'auto' (follows the system). Options: 'auto' | 'light' | 'dark'
    workspace?: {
      leftSide: string[]; // [Required] List of panel names. Default: ['structure', 'nerve']
      rightSide: string[]; // [Required] List of panel names. Default: ['xml-viewer', 'image-viewer', 'validator']
    };
  };
}

export interface LWDocument {
  url?: string;
  xml: string;
}

export interface ConfigLegacy {
  cwrcRootUrl?: string;
  helpUrl?: string;
  nerveUrl?: string;
  proxyXmlEndpoint?: string;
  proxyCssEndpoint?: string;

  services?: any;

  container?: string;
  storageDialogs?: Object;
  schema?: any;
  modules?: Object;
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

export type Schema = {
  id: string;
  name: string;
  mapId?: string;
  schemaMappingsId: string;
  xml?: string | string[];
  css?: string | string[];
  xmlUrl: string | string[];
  cssUrl: string | string[];
};

export interface Language {
  code: string;
  name: string;
  shortName: string;
}

export const Languages: Map<string, Language> = new Map();

export type ErrorType = 'info' | 'warning' | 'error';

export interface IError {
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

export type MappingID = 'cwrcEntry' | 'orlando' | 'tei' | 'teiLite';
