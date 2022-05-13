import Writer from '../js/Writer';
import { Bookmark, Editor } from 'tinymce/tinymce';
import { ILookupsConfig } from '../components/entityLookups/types';

export type { ILookupsConfig, Authority } from '../components/entityLookups/types';

export declare var webpackEnv: {
  LEAFWRITER_VERSION?: string;
  NODE_ENV: string;
  WORKER_ENV: string;
};

export interface LeafWriterConfig {
  document: LWDocument;
  user: User;
  editor: {
    language?: string;
    colorScheme?: string;
    schemas?: [SupportedSchemasId | Schema];
    credentials?: {
      nssiToken?: string | (() => Promise<string | undefined>);
    };
    //? legacy
    legacy?: ConfigLegacy;
    lookups: ILookupsConfig;
  };
  onLoadRequest?: () => void;
  onSaveRequest?: (document: LWDocument, saveAs?: boolean) => Promise<onSaveRequestResults>;
  preferences?: {
    themeMode?: string; // [Optional] Use dark/light mode. Default: 'auto' (follows the system). Options: 'auto' | 'light' | 'dark'
    fontSize?: number; // [Optional] Changes the document's default font size. Default: 11. Options: 10-18
    // [Optional] Reorganize panels position in space. If present, both left and right side must be defined.
    workspace?: {
      leftSide: string[]; // [Required] List of panel names. Default: ['structure', 'nerve']
      rightSide: string[]; // [Required] List of panel names. Default: ['xml-viewer', 'image-viewer', 'validator']
    };
  };
}

export interface onSaveRequestResults {
  hash?: string;
  reason?: string;
  success: boolean;
}

export interface LWDocument {
  file?: Resource;
  title?: string;
  url: string;
  xml: string;
}

export interface ConfigLegacy {
  cwrcRootUrl?: string;
  helpUrl?: string;
  nerveUrl?: string;
  proxyXmlEndpoint?: string;
  proxyCssEndpoint?: string;

  onLoadRequest?: () => void;
  onSaveRequest?: (document: LWDocument, saveAs?: boolean) => Promise<onSaveRequestResults>;

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

export interface Resource {
  provider?: string;
  owner?: string;
  ownertype?: string;
  repo?: string;
  path?: string;
  filename?: string;
  content?: string;
  hash?: string;
  url?: string;
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
  name: string;
  url: string;

  permissions?: string;
  prefferedID?: string;
  username?: string;

  avatar_url?: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  prefStorageProvider?: string;
  identities?: {
    [x: string]: any; //Allow more properties
  };
  
  signOut?: () => Promise<void>;
}

export interface Resource {
  provider?: string;
  owner?: string;
  ownertype?: string;
  repo?: string;
  path?: string;
  filename?: string;
  content?: string;
  hash?: string;
  url?: string;
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
