import { SupportedProviderIds } from '@src/config';
import type { AuthenticateProp, Provider, ProviderId } from '@src/services';
import { Context } from '../index';

export const setup = ({ state }: Context, lincsProviders: Provider[]) => {
  state.providers.supportedProviders = lincsProviders.filter(
    (p) => p.enabled && SupportedProviderIds.includes(p.providerId as ProviderId)
  );
};

export const initProvider = async (
  { state, effects }: Context,
  { IDPTokens, providerName, userId, userName }: AuthenticateProp
) => {
  if (!SupportedProviderIds.includes(providerName as ProviderId)) return;

  let supportedProvider = state.providers.supportedProviders.find(
    (provider) => provider.providerId === providerName
  );
  if (!supportedProvider) return;

  const module = await effects.providers.loadModule(supportedProvider.providerId as ProviderId);
  if (!module) return;

  supportedProvider.service = module;

  supportedProvider.service.authenticate({ IDPTokens, userName, userId });

  return supportedProvider;
};

export const isProviderInitilized = ({ state }: Context, providerId: string) => {
  return !!state.providers.supportedProviders.find((p) => p.providerId === providerId && p.service);
};

export const getStorageProviderAuth = ({ state }: Context, providerId: string) => {
  const provider = state.providers.storageProviders.find(
    (p) => p.providerId === providerId && p.service
  );
  if (!provider?.service) return;
  return { name: provider.service.name, access_token: provider.service.getAccessToken() };
};

export const getStorageProvidersAuth = ({ state, actions }: Context) => {
  const auths: { name: string; access_token: string }[] = [];

  state.providers.storageProviders.forEach((provider) => {
    const access_token = provider.service?.getAccessToken();
    if (access_token) auths.push({ name: provider.providerId, access_token });
  });
  
  return auths;
};

export const isStorageProviderSupported = ({ state }: Context, providerId: string) => {
  return !!state.providers.storageProviders.find((p) => p.providerId === providerId && p.service);
};
