import type { IconName } from '../icons';
import type { ProviderAuth } from './Provider';

export * from './assert';

export interface StorageDialogProps {
  open: boolean;
  config?: StorageDialogConfig;
  onBackdropClick?: () => void;
  onCancel?: () => void;
  onChange?: (resource?: Resource) => void;
  onLoad?: (resource: Resource) => void;
  onSave?: (resource: Resource) => void;
  resource?: Resource | string;
  source?: StorageSource;
  type?: DialogType;
}

export type DialogType = 'load' | 'save';
export type StorageSource = 'cloud' | 'local' | 'paste';

export interface StorageDialogConfig {
  allowedMimeTypes?: AllowedMimeType[];
  allowPaste?: boolean;
  defaultCommitMessage?: string;
  providers?: ProviderAuth[];
  preferProvider?: string;
  showInvisibleFiles?: boolean;
  validate?: Validate;
}

export type AllowedMimeType =
  | 'application/json'
  | 'application/pdf'
  | 'application/xml'
  | 'text/csv'
  | 'text/html'
  | 'text/plain';

export interface SelectedItem {
  organization?: Organization;
  path?: string;
  repository?: Repository;
  type?: 'file' | 'folder' | 'repo' | 'org';
}

export type Validate = (content: string) => { valid: boolean; error?: string };

export type SuportedProviders = 'github' | 'gitlab';

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

export interface SourcePanelOption {
  icon: IconName;
  label: string;
  value: StorageSource | SuportedProviders;
}

export type ErrorType = 'info' | 'warning' | 'error';

export interface Error {
  type: ErrorType;
  message: string;
}

export interface Language {
  code: string;
  name: string;
  shortName: string;
}

export type Languages = {
  [key: string]: Language;
};

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
}

export interface Owner {
  id: string;
  name?: string;
  type: UserType;
  username: string;
}

export interface DropFile {
  file: File;
  preview: string;
}

export type CollectionSource = 'owner' | 'collaborator' | 'organization';
export type CollectionType = 'repos' | 'content' | 'organizations';

export type UserType = 'user' | 'organization';

export interface NavigateToPathParams {
  org?: Organization;
  repo?: Repository;
  path?: string;
}

export interface Repository {
  name: string;
  id: string;
  description?: string;
  default_branch: string;
  owner: {
    username: string;
    [x: string]: any;
  };
  path: string;
  writePermission?: boolean;
  [x: string]: any;
}

export interface Content {
  name: string;
  nameHighlight?: HighlightParts[];
  path: string;
  id?: string;
  type?: 'file' | 'folder';
  [x: string]: any;
}

export interface HighlightParts {
  highlight: boolean;
  text: string;
}

export interface Organization extends Owner {
  avatar_url?: string;
  [x: string]: any;
}

export interface PublicRepository {
  [storage: string]: Owner[];
}

export interface SearchResults {
  results: SearchResultsBlobs[] | Content[];
  searchType: string;
}

export interface SearchResultsBlobs extends Content {
  owner: User;
  repository: Repository;
  score?: number;
  text_matches: any[];
}

export interface DocumentDetails {
  content: string;
  hash: string;
  url: string;
}

export interface MessageDialog {
  open: boolean;
  closable?: boolean;
  fullWidth?: boolean;
  labelCancelButton?: string;
  labelConfirmButton?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  onCancel?: () => void;
  onClose?: () => void;
  onConfirm?: () => void;
  progress?: boolean;
  title?: string;
}

export interface AlertDialog {
  open: boolean;
  message?: string;
  onClose?: () => void;
  type?: 'error' | 'info' | 'success' | 'warning';
}

export interface Submit {
  action: SubmitAction;
  resource: Resource;
}

export type SubmitAction = 'load' | 'save';

export interface FetchDocumentParams {
  filename?: string;
  path: string;
  repo?: Repository;
}

export interface GetFileLatestHashParams {
  filename: string;
  path: string[];
  repository: Repository;
  owner: Owner;
}
