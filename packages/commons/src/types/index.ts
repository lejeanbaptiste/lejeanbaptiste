import type { OptionsObject, SnackbarMessage } from 'notistack';
import React from 'react';

export interface Language {
  code: string;
  name: string;
  shortName: string;
}

export type PaletteMode = 'light' | 'auto' | 'dark';

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
  username: string;
  identities: Map<string, IIdentity>;
  preferredID: string;
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
  preferredID: string;
  username?: string;
}

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

export const ErrorTypes = ["info", "warning", "error"] as const;
type ErrorType = typeof ErrorTypes[number];

export interface IError {
  type: ErrorType;
  message: string;
}

export interface IProviderAuth {
  access_token: string;
  name: string;
}

export interface ISample {
  category: string;
  icon?: string;
  title: string;
  url: string;
}
