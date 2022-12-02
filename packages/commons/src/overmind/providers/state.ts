import { SupportedStorageProviders } from '@src/config';
import type { SupportedProvider } from '@src/services';
import { derived } from 'overmind';

type State = {
  authProviders: SupportedProvider[];
  identityProviders: SupportedProvider[];
  supportedProviders: SupportedProvider[];
  storageProviders: SupportedProvider[];
};

export const state: State = {
  authProviders: derived(({ supportedProviders }: State) =>
    supportedProviders.filter((supported) => !supported.linkOnly)
  ),
  identityProviders: derived(({ supportedProviders }: State) =>
    supportedProviders.filter((supported) => supported.service)
  ),
  supportedProviders: [],
  storageProviders: derived(({ supportedProviders }: State) =>
    supportedProviders.filter((provider) => SupportedStorageProviders.includes(provider.providerId))
  ),
};
