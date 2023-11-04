import { Error } from '../types';

export function isErrorMessage(param: unknown): param is Error {
  return (param as Error).message !== undefined && (param as Error).type !== undefined;
}
