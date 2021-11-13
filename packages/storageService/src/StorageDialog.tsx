import MessageDialog from './components/MessageDialog';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React, { FC } from 'react';
import type { StorageDialogProps } from './@types/types';
import Main from './main';
import i18next from './i18n';
import { config } from './overmind';
import { I18nextProvider } from 'react-i18next';

export type { AllowedMimeType, Resource } from './@types/types';
export type { ProviderAuth } from './@types/Provider';

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
