import { Languages, type IError } from '../types';

export const supportedLanguages: typeof Languages = new Map([
  ['en-CA', { code: 'en-CA', name: 'english', shortName: 'en' }],
  ['fr-CA', { code: 'fr-CA', name: 'french', shortName: 'fr' }],
]);

export function isErrorMessage(param: any): param is IError {
  return (param as IError).message !== undefined;
}
