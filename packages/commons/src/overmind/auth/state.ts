import type { User } from '@src/types';

interface State {
  user?: User;
  userState: 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED';
}

export const state: State = {
  userState: 'AUTHENTICATING',
};
