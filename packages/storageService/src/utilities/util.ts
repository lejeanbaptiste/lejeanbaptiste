import { Error, ErrorType, Languages } from '../types';

export const supportedLanguages: Languages = {
  'en-CA': { code: 'en-CA', name: 'english', shortName: 'en' },
  'fr-CA': { code: 'fr-CA', name: 'french', shortName: 'fr' },
};

export function isErrorMessage(param: unknown): param is Error {
  return (param as Error).message !== undefined && (param as Error).type !== undefined;
}
