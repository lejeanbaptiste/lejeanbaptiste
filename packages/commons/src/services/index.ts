import type { IdentityProvider, AuthenticateProp } from './IdentityProvider';
import { GithubIdentityProvider } from './github';
import { GitlabIdentityProvider } from './gitlab';
import { OrcidIdentityProvider } from './orcid';
import type { IdentityProvider as IdentityProviderType, StorageProvider } from '@src/@types/types';

// export const supportedIdentityProviders: IdentityProviderType[] = ['orcid', 'gitlab', 'github'];
export const supportedIdentityProviders: IdentityProviderType[] = ['gitlab', 'github'];
export const suportedStorageProviders: StorageProvider[] = ['gitlab', 'github'];

export const setIndentityProvider = ({
  IDPTokens,
  providerName,
  userId,
  userName,
}: AuthenticateProp) => {
  if (!providerName || !supportedIdentityProviders.includes(providerName as IdentityProviderType)) {
    throw new Error('Identity Provider not supported');
  }

  let provider: IdentityProvider;

  if (providerName === 'github') provider = GithubIdentityProvider;
  else if (providerName === 'gitlab') provider = GitlabIdentityProvider;
  else if (providerName === 'orcid') provider = OrcidIdentityProvider;
  else throw new Error('Identity Provider not supported');

  provider.authenticate({ IDPTokens, userName, userId });

  return provider;
};
