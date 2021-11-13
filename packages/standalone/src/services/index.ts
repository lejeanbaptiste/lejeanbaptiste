import type { IdentityProvider, AuthenticateProp } from './IdentityProvider';
import type { StorageProvider } from './StorageProvider';
import { GithubIdentityProvider, GithubStorageProvider } from './github/github';
import { GitlabIdentityProvider, GitlabStorageProvider } from './gitlab/gitlab';
import { OrcidIdentityProvider } from './orcid/orcid';

export const supportedIdentityProviders = ['orcid', 'gitlab', 'github'];
export const suportedStorageProviders = ['gitlab', 'github'];

export const setIndentityProvider = ({
  IDPTokens,
  providerName,
  userId,
  userName,
}: AuthenticateProp) => {
  if (!providerName || !supportedIdentityProviders.includes(providerName)) {
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

export const setStorageProvider = ({
  access_token,
  providerName,
  userId,
  userName,
}: AuthenticateProp) => {
  if (!providerName || !suportedStorageProviders.includes(providerName)) {
    throw new Error('Storage Provider not supported');
  }

  let provider: StorageProvider;

  if (providerName === 'github') provider = GithubStorageProvider;
  else if (providerName === 'gitlab') provider = GitlabStorageProvider;
  else throw new Error('Storage Provider not supported');

  provider.authenticate({ access_token, userName, userId });

  return provider;
};
