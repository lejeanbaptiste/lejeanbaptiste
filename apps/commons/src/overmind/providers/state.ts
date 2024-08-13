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
  identityProviders: derived(({ supportedProviders }: State) => {
    const _identityProviders = supportedProviders.filter((provider) => {
      if (!provider.providerId) return false;
      const isSupported = supportedIdentityProviders.includes(provider.providerId);
      return isSupported;
    });
    return _identityProviders;
  }),
  supportedProviders: [],
  storageProviders: derived(({ supportedProviders }: State) => {
    const _storageProviders = supportedProviders.filter((provider) => {
      if (!provider.providerId) return false;
      const isSupported = supportedStorageProviders.includes(provider.providerId);
      return isSupported;
    });
    return _storageProviders;
  }),
};
