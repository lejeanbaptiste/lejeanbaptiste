import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React, { FC } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { StorageDialogProps } from './types';
import MessageDialog from './components/MessageDialog';
import i18next from './i18n';
import Main from './main';
import { config } from './overmind';

export type { ProviderAuth } from './types/Provider';
export type { AllowedMimeType, Resource } from './types';

const overmind = createOvermind(config, {
  name: 'StorageDialog',
  logProxies: true,
});

const StorageDialog: FC<StorageDialogProps> = (props) => (
  <Provider value={overmind}>
    <I18nextProvider i18n={i18next}>
      <Main {...props} />
      <MessageDialog />
    </I18nextProvider>
  </Provider>
);

export default StorageDialog;
