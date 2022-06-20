import { Context } from '../';
import type { User } from '../../types';

export const setUser = ({ state }: Context, user: User) => {
  state.user = user;
};
