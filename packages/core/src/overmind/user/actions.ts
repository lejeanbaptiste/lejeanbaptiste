import { Context } from '../';
import type { User } from '../../types';

export const setUser = ({ state, actions }: Context, user?: User) => {
  if (!user) user = actions.user.createAnonymoustUser();
  state.user = user;
};

export const createAnonymoustUser = ({ state }: Context) => {
  const user: User = {
    name: 'Anonymous',
    uri: '#anonymous',
  };

  return user;
};

export const clear = ({ state }: Context) => {
  state.user = {
    name: 'Anonymous',
    uri: '#anonymous',
  };
}