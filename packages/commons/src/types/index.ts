import { OptionsObject, SnackbarMessage } from 'notistack';
import React from 'react';

export declare var webpackEnv: {
  NODE_ENV: string;
  WORKER_ENV: string;
};

export interface Language {
  code: string;
  name: string;
  shortName: string;
}

export type PaletteMode = 'light' | 'auto' | 'dark';

export const Languages: Map<string, Language> = new Map();

export type IdentityProvider = 'github' | 'gitlab' | 'orcid';
export type StorageProvider = 'github' | 'gitlab';

export interface INotification {
  dismissed?: boolean;
  key?: string | number;
  message: SnackbarMessage;
  options?: OptionsObject;
}

export interface User {
  avatar_url?: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  username?: string;
  identities: Map<string, IIdentity>;
  prefferedID: string;
  prefStorageProvider: string;
  url: string;
}

export interface IIdentity {
  name: string;
  uri: string;
  username: string;
  [x: string]: any; //Allow more properties
}

export interface IAnnotationUserProfile {
  name: string;
  url: string;

  avatar_url?: string;
  email?: string;
  prefferedID: string;
  username?: string;
}

export type AffiliationType = 'owner' | 'collaborator' | 'organization';

export interface MessageDialog {
  closable?: boolean;
  message?: string | React.ReactNode;
  labelNoButton?: string;
  labelYesButton?: string;
  onClose?: () => void;
  onNo?: () => void;
  onYes?: () => void;
  open: boolean;
  title?: string;
}

export interface AlertDialog {
  open: boolean;
  message?: string;
  onClose?: () => void;
  type?: 'error' | 'info' | 'success' | 'warning';
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
  schemaName?: string;
  modifiedAt?: Date;
}

export type ErrorType = 'info' | 'warning' | 'error';

export interface Error {
  type?: ErrorType;
  message: string;
}

export interface IProviderAuth {
  access_token: string;
  name: string;
}
