import { Context } from '../';
import { User } from '../../@types';

export const setUser = ({ state }: Context, user: User) => {
  state.user = user;
};
