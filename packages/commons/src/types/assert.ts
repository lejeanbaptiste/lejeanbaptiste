import { ErrorTypes, type Error } from '@src/types';

export const isErrorMessage = (param: unknown): param is Error => {
  const hasMessage = (param as Error).message !== undefined;
  const hastype = (param as Error).type !== undefined;
  const hasRightType = ErrorTypes.includes((param as Error).type);

  return hasMessage && hastype && hasRightType;
};
