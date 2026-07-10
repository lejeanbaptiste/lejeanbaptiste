import type { IdentityProviderRepresentation } from '@lincs.project/auth-api-contract';
import { SupportedProviderIds } from '../config';

export type ProviderId = (typeof SupportedProviderIds)[number];

export interface AuthenticateProp {
  access_token?: string;
  IDPTokens?: string | Record<string, unknown>;
  providerName: string;
  userId?: string;
  userName?: Readonly<string>;
}

export interface ProviderService {
  name: string;
  isIdentityProvider: boolean;
  isStorageProvider: boolean;
  authenticate(params: Omit<AuthenticateProp, 'providerName'>): void;
  getAccessToken: () => string;
  getAuthenticatedUser(userId?: string): unknown;
  getUserId: () => string;
  getUserName: () => string;
}

export type Providers = IdentityProviderRepresentation[];
export type Provider = Providers[0];

export interface SupportedProvider extends Provider {
  providerId?: string;
  linkOnly?: boolean;
  service?: ProviderService;
}
