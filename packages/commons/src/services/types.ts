import { z } from 'zod';
import { SupportedProviderIds } from '../config';

export type ProviderId = typeof SupportedProviderIds[number];

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

const GetProvidersSchema = z
  .object({
    enabled: z.boolean(),
    linkOnly: z.boolean(),
    providerId: z.string(),
    storeToken: z.boolean(),
  })
  .array();

export type Provider = z.infer<typeof GetProvidersSchema.element>;

export interface SupportedProvider extends Provider {
  service?: ProviderService;
}
