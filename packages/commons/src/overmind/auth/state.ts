import type { User } from '@src/types';

type State = {
  user?: User;
  userState: 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED';
};

export const state: State = {
  userState: 'AUTHENTICATING',
};
