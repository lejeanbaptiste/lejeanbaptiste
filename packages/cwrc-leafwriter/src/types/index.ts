import { OptionsObject, SnackbarMessage } from 'notistack';
import type { Bookmark, Editor } from 'tinymce/tinymce';
import { Locales } from '../i18n';
import Writer from '../js/Writer';
import type { AuthorityServiceConfig } from './authority';

export * from './assert';
export * from './authority';

// eslint-disable-next-line no-var
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
    leftSide: string[]; // [Required] List of panel names. Default: ['structure']
    rightSide: string[]; // [Required] List of panel names. Default: ['xml-viewer', 'image-viewer', 'validator']
  };
}

export interface LeafWriterOptionsSettings {
  container?: string;

  baseUrl?: string;

  colorScheme?: string;
  // eslint-disable-next-line @typescript-eslint/ban-types
  locale?: Locales | (string & {});

  authorityServices?: AuthorityServiceConfig[];
  schemas?: Schema[];
  schemasId?: SupportedSchemasId[];

  modules?: ISettingsModules;
  services?: any;

  readonly?: boolean;
  annotator?: boolean;
  mode?: string;
  allowOverlap?: boolean;
}

export type SupportedSchemasId = 'orlando' | 'teiAll' | 'teiLite' | 'teiSimplePrint' | 'jTei';

interface ISettingsModules {
  west: ISettingsModulesPanel[];
  east: ISettingsModulesPanel[];
}

interface ISettingsModulesPanel {
  id: ISettingsModuleName;
  title: string;
}

export type ISettingsModuleName =
  | 'toc'
  | 'markup'
  | 'entities'
  | 'imageViewer'
  | 'validation'
  | 'code';

export const SupportedSchemas = new Map<string, Schema>();

export interface User {
  name: string;
  uri: string;
}

export const SchemaMappings = ['cwrcEntry', 'orlando', 'tei', 'teiLite'] as const;
export type SchemaMappingType = (typeof SchemaMappings)[number];

export interface Schema {
  css: string[];
  editable?: boolean;
  id: string;
  mapping: SchemaMappingType;
  name: string;
  rng: string[];
}

export type ErrorType = 'info' | 'warning' | 'error';

export interface Error {
  type?: ErrorType;
  message: string;
}

export type EntityType =
  | 'citation'
  | 'concept'
  | 'correction'
  | 'date'
  | 'keyword'
  | 'link'
  | 'note'
  | 'organization'
  | 'place'
  | 'person'
  | 'thing'
  | 'work';

//UI
export type PaletteMode = 'light' | 'dark' | 'system';

export interface ContextMenuState {
  allowsMerge?: boolean;
  anchorEl?: Element;
  count?: number;
  eventSource?: 'editor' | 'ribbon' | 'markupPanel';
  nodeType?: 'tag' | 'text';
  position?: { posX: number; posY: number };
  show: boolean;
  tagId?: string | string[];
  useSelection?: boolean;
  xpath?: string;
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

export type Side = 'left' | 'right';

export type PanelId = 'toc' | 'markup' | 'entities' | 'validate' | 'xmlViewer' | 'imageViewer';

export interface PanelProp {
  id: PanelId;
  label: string;
}

export interface SideItem extends PanelProp {
  hide?: boolean;
}

export interface SideProp {
  hide?: boolean;
  id: Side;
  items: SideItem[];
}

export interface SectionProp {
  activePanel: PanelId | null;
  collapsed?: boolean;
  hide?: boolean;
  id: Side;
  panels: PanelId[];
}

export interface LayoutProps {
  outerLeft?: SideProp;
  left: SectionProp;
  right?: SectionProp;
  outerRight?: SideProp;
}
