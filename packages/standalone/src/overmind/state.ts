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
  recentDocuments: Resource[];
  resource?: Resource;
  storageDialogState: StorageDialogState;
  storageProviders: { [key: string]: StorageProvider };
  templates: { title: string; url: string }[];
  themeAppearance: PaletteMode;
  user?: User;
  userAuthenticated: boolean | 'authenticating';
};

export const state: State = {
  authenticationServiceName: 'lincs-keycloak',
  darkMode: false,
  identityProviders: {},
  language: { code: 'en-CA', name: 'english', shortName: 'en' },
  messageDialog: { open: false },
  prefStorageProvider: '',
  recentDocuments: [],
  storageDialogState: { open: false },
  storageProviders: {},
  templates: [
    {
      title: 'Blank',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20blank%20template.xml',
    },
    {
      title: 'Letter',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20letter%20template.xml',
    },
    {
      title: 'Poem',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20poem%20template.xml',
    },
    {
      title: 'Prose',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20prose%20template.xml',
    },
  ],
  themeAppearance: 'auto',
  userAuthenticated: 'authenticating',
};
