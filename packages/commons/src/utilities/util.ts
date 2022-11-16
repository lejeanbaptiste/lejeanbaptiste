import { ErrorTypes, type IError, type Language } from '@src/types';

export const supportedLanguages: Map<string, Language> = new Map([
  ['en-CA', { code: 'en-CA', name: 'english', shortName: 'en' }],
  ['fr-CA', { code: 'fr-CA', name: 'french', shortName: 'fr' }],
]);

export const isErrorMessage = (param: unknown): param is IError => {
  const hasMessage = (param as IError).message !== undefined;
  const hastype = (param as IError).type !== undefined;
  const hasRightType = ErrorTypes.includes((param as IError).type);

  return hasMessage && hastype && hasRightType;
};

export const isValidXml = (string: string) => {
  const doc = new DOMParser().parseFromString(string, 'text/xml');
  const parsererror = doc.querySelector('parsererror');
  return !parsererror;
};
