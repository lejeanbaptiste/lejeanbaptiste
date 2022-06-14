import type { IdentityProvider } from '@src/services/IdentityProvider';
import { User } from '@src/types';

type State = {
  authenticationServiceName: string;
  identityProviders: { [key: string]: IdentityProvider };
  user?: User;
  userState: 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED';
};

export const state: State = {
  authenticationServiceName: 'lincs-keycloak',
  identityProviders: {},
  userState: 'UNAUTHENTICATED',
};
