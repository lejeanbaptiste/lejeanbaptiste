import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React, { FC } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { StorageDialogProps } from './types';
import MessageDialog from './components/MessageDialog';
import AlertDialog from './components/AlertDialog';
import i18next from './i18n';
import Main from './main';
import { config } from './overmind';

export type { ProviderAuth } from './types/Provider';
export type { AllowedMimeType, Resource } from './types';
export { loadDocument, saveDocument } from './headless';

const overmind = createOvermind(config, {
  name: 'storageDialog',
  logProxies: true,
});

const StorageDialog: FC<StorageDialogProps> = (props) => (
  <Provider value={overmind}>
    <I18nextProvider i18n={i18next}>
      <Main {...props} />
      <MessageDialog />
      <AlertDialog />
    </I18nextProvider>
  </Provider>
);

export default StorageDialog;
