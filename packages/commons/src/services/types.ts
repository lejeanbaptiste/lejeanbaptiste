import { contract } from '@lincs.project/auth-api-contract';
import { type ClientInferResponseBody } from '@ts-rest/core';
import { SupportedProviderIds } from '../config';

export type ProviderId = (typeof SupportedProviderIds)[number];

export type AuthenticateProp = {
  access_token?: string;
  IDPTokens?: string | any;
  providerName: string;
  userId?: string;
  userName?: Readonly<string>;
};

export interface ProviderService {
  name: string;
  isIdentityProvider: boolean;
  isStorageProvider: boolean;
  authenticate(params: Omit<AuthenticateProp, 'providerName'>): void;
  getAccessToken: () => string;
  getAuthenticatedUser(userId?: string): any;
  getUserId: () => string;
  getUserName: () => string;
}

export type Providers = ClientInferResponseBody<typeof contract.v1.providers.getAll, 200>;
export type Provider = Providers[0];

export interface SupportedProvider extends Provider {
  service?: ProviderService;
}
