import { GithubIdentityProvider as github } from './github';
// import { GitlabIdentityProvider as gitlab } from './gitlab';
// import { OrcidIdentityProvider as orcid } from './orcid';

export type IdentityProviderName = 'github'; // | 'gitlab' | 'orcid';
export type StorageProviderName = 'github'; // | 'gitlab';

export type AuthenticateProp = {
  access_token?: string;
  IDPTokens?: string | any;
  providerName?: string;
  userId?: string;
  userName?: Readonly<string>;
};

export interface IIdentityProvider {
  name: string;
  authenticate(params: AuthenticateProp): void;
  getAccessToken: () => string;
  getAuthenticatedUser(userId?: string): any;
  getUserId: () => string;
  getUserName: () => string;
}

export type IStorageProvider = IIdentityProvider;

export const authServices: Map<IdentityProviderName, IIdentityProvider> = new Map([
  ['github', github],
  // ['gitlab', gitlab],
]);

export const identityServices: Map<IdentityProviderName, IIdentityProvider> = new Map(
  ...[authServices],
  [
    // ['orcid', orcid],
  ]
);

export const storageServices: Map<StorageProviderName, IStorageProvider> = new Map([
  ['github', github],
  // ['gitlab', gitlab],
]);

export const supportedAuthProviders = [...authServices.keys()];
export const supportedIdentityProviders = [...identityServices.keys()];
export const suportedStorageProviders = [...storageServices.keys()];
