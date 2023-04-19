import ModalProvider from 'mui-modal-provider';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18next from './i18n';
import { Main } from './main';
import { config } from './overmind';
import type { StorageDialogProps } from './types';

export { clearCache, deleteDb } from './db';
export { loadDocument, saveDocument } from './headless';
export type { AllowedMimeType, Resource, StorageDialogProps, Validate } from './types';
export type { ProviderAuth } from './types/Provider';
export type { LanguageCode } from './utilities';

const overmind = createOvermind(config, { name: 'Storage Service', logProxies: true });

const StorageDialog = (props: StorageDialogProps) => (
  <Provider value={overmind}>
    <I18nextProvider i18n={i18next}>
      <ModalProvider>
        <Main {...props} />
      </ModalProvider>
    </I18nextProvider>
  </Provider>
);

export default StorageDialog;
