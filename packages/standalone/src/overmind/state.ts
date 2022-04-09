import {
  Language,
  MessageDialog,
  PaletteMode,
  Resource,
  StorageDialogState,
  StorageProvider,
  User,
} from '@src/@types/types';
import type { IdentityProvider } from '@src/services/IdentityProvider';

type State = {
  authenticationServiceName: string;
  darkMode: boolean;
  identityProviders: { [key: string]: IdentityProvider };
  language: Language;
  messageDialog: MessageDialog;
  recentDocuments: Resource[];
  resource?: Resource;
  sampleDocuments?: { title: string; url: string }[];
  storageDialogState: StorageDialogState;
  storageProviders: StorageProvider[];
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
  recentDocuments: [],
  sampleDocuments: [
    {
      title: 'Sample Letter',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20letter%20template.xml',
    },
    {
      title: 'Sample Poem',
      url: 'https://raw.githubusercontent.com/cwrc/CWRC-Writer-Templates/master/templates/TEI%20poem%20template.xml',
    },
  ],
  storageDialogState: { open: false },
  storageProviders: [],
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
