import { Language, MessageDialog, Resource, StorageDialogState, User } from '@src/@types/types';
import type { IdentityProvider } from '@src/services/IdentityProvider';
import type { StorageProvider } from '@src/services/StorageProvider';
import { supportedLanguages } from '@src/utilities/util';

type State = {
  authenticationServiceName: string;
  darkMode: boolean;
  identityProviders: { [key: string]: IdentityProvider };
  language: Language;
  messageDialog: MessageDialog;
  prefStorageProvider: string;
  resource?: Resource;
  storageDialogState: StorageDialogState;
  storageProviders: { [key: string]: StorageProvider };
  user?: User;
  userAuthenticated: boolean | 'authenticating';
};

export const state: State = {
  authenticationServiceName: 'lincs-keycloak',
  darkMode: false,
  identityProviders: {},
  language: supportedLanguages['en-CA'],
  messageDialog: { open: false },
  prefStorageProvider: '',
  storageDialogState: { open: false },
  storageProviders: {},
  userAuthenticated: 'authenticating',
};
