import type { IconName } from '@src/icons';
import type { OptionsObject, SnackbarMessage } from 'notistack';

export * from './assert';

// eslint-disable-next-line no-var
export declare var webpackEnv: {
  NODE_ENV: string;
  WORKER_ENV: string;
};

export type PaletteMode = 'light' | 'auto' | 'dark';

export interface NotificationProps {
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
  identities: Map<string, IdentityProps>;
  preferredID: string;
  prefStorageProvider?: string;
  url: string;
}

export interface IdentityProps {
  id: string;
  name: string;
  uri: string;
  username: string;
  [x: string]: unknown; //Allow more properties
}

export interface AnnotationUserProfileProps {
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
  id?: string;

  provider?: string;
  owner?: string;
  ownerType?: string;
  repo?: string;
  path?: string;
  filename?: string;
  content?: string;
  hash?: string;
  url?: string;
  writePermission?: boolean;

  schemaName?: string;
  modifiedAt?: Date;
  screenshot?: string;

  title?: string;
  category?: string;
  icon?: IconName;

  isLocal?: boolean;
  blob?: Blob;
}

export const ErrorTypes = ['info', 'warning', 'error'] as const;
type ErrorType = (typeof ErrorTypes)[number];

export interface Error {
  message: string;
  title?: string;
  type: ErrorType;
}

export interface ProviderAuthProps {
  access_token: string;
  name: string;
}

export interface ViewProps {
  title?: string;
  value: ViewType;
}

export type ViewType = 'blank' | 'recent' | 'samples' | 'templates';

export interface FileDetail {
  content: string;
  file: File;
}

export interface DocumentRequested extends Resource {
  expires: Date;
  id: string;
}
