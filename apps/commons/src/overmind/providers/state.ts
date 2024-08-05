import { supportedStorageProviders, supportedIdentityProviders } from '@src/config';
import type { SupportedProvider } from '@src/services';
import { derived } from 'overmind';

interface State {
  authProviders: SupportedProvider[];
  identityProviders: SupportedProvider[];
  supportedProviders: SupportedProvider[];
  storageProviders: SupportedProvider[];
}

export const state: State = {
  authProviders: derived(({ supportedProviders }: State) =>
    supportedProviders.filter((supported) => !supported.linkOnly),
  ),
  identityProviders: derived(({ supportedProviders }: State) =>
    supportedProviders.filter((provider) => {
      if (!provider.providerId) return false;
      supportedIdentityProviders.includes(provider.providerId);
    }),
  ),
  supportedProviders: [],
  storageProviders: derived(({ supportedProviders }: State) =>
    supportedProviders.filter((provider) => {
      if (!provider.providerId) return false;
      supportedStorageProviders.includes(provider.providerId);
    }),
  ),
};
