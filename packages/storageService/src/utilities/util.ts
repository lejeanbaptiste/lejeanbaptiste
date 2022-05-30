import { IError, Languages } from '../@types/types';

export const supportedLanguages: Languages = {
  'en-CA': { code: 'en-CA', name: 'english', shortName: 'en' },
  'fr-CA': { code: 'fr-CA', name: 'french', shortName: 'fr' },
};

export function isErrorMessage(param: any): param is IError {
  return (param as IError).message !== undefined;
}
