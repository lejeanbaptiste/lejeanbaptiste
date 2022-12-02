import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React, { FC } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { StorageDialogProps } from './types';
import i18next from './i18n';
import Main from './main';
import { config } from './overmind';
import ModalProvider from 'mui-modal-provider';

export type { ProviderAuth } from './types/Provider';
export type { AllowedMimeType, Resource, Validate } from './types';
export { loadDocument, saveDocument } from './headless';

const overmind = createOvermind(config, {
  name: 'Storage Service',
  logProxies: true,
});

const StorageDialog: FC<StorageDialogProps> = (props) => (
  <Provider value={overmind}>
    <I18nextProvider i18n={i18next}>
      <ModalProvider>
        <Main {...props} />
      </ModalProvider>
    </I18nextProvider>
  </Provider>
);

export default StorageDialog;
