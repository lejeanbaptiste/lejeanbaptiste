import ModalProvider from 'mui-modal-provider';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import { I18nextProvider } from 'react-i18next';
import i18next from './i18n';
import { Main } from './main';
import { config } from './overmind';
import type { StorageDialogProps } from './types';

export type { Locales } from './i18n';
export type {
  AllowedMimeType,
  DialogType,
  Resource,
  StorageDialogProps,
  StorageSource,
  Validate,
} from './types';
export type { ProviderAuth } from './types/Provider';

const overmind = createOvermind(config, { name: 'StorageDialog', logProxies: true });

export const StorageDialog = (props: StorageDialogProps) => (
  <Provider value={overmind}>
    <I18nextProvider i18n={i18next}>
      <ModalProvider>
        <Main {...props} />
      </ModalProvider>
    </I18nextProvider>
  </Provider>
);

export default StorageDialog;
