import type { identityServices } from '@src/services';
import type { User } from '@src/types';

type State = {
  identityProviders: typeof identityServices;
  user?: User;
  userState: 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED';
};

export const state: State = {
  identityProviders: new Map(),
  userState: 'UNAUTHENTICATED',
};
