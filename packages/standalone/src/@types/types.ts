export declare var webpackEnv : {
  NODE_ENV: string
  WORKER_ENV: string;
}
export interface Language {
  code: string;
  name: string;
  shortName: string;
}

export type PaletteMode = 'light' | 'auto' | 'dark';

export const Languages: Map<string, Language> = new Map();

export type IdentityProvider = 'github' | 'gitlab' | 'orcid';
export type StorageProvider = 'github' | 'gitlab';

export interface User {
  avatar_url?: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  username?: string;
  identities: {
    [x: string]: any; //Allow more properties
  };
  prefferedID: string;
  prefStorageProvider: string;
}

export type AffiliationType = 'owner' | 'collaborator' | 'organization';

export interface MessageDialog {
  closable?: boolean;
  message?: string;
  labelNoButton?: string;
  labelYesButton?: string;
  onClose?: () => void;
  onNo?: () => void;
  onYes?: () => void;
  open: boolean;
  title?: string;
}

export interface StorageDialogState {
  open: boolean;
  source?: 'cloud' | 'local' | 'paste';
  type?: 'load' | 'save';
  resource?: Resource | string;
}

export type DialogType = 'load' | 'save';
export type SourceFile = 'cloud' | 'local' | 'paste';
export interface DropFile {
  file: File;
  preview: string;
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

export type ErrorType = 'info' | 'warning' | 'error';

export interface Error {
  type?: ErrorType;
  message: string;
}

export interface IProviderAuth {
  name: string;
  access_token: string;
}
