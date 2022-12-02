import { Languages, type Error } from '../types';

export const supportedLanguages: typeof Languages = new Map([
  ['en-CA', { code: 'en-CA', name: 'english', shortName: 'en' }],
  ['fr-CA', { code: 'fr-CA', name: 'french', shortName: 'fr' }],
]);

export function isErrorMessage(param: any): param is Error {
  return (param as Error).message !== undefined;
}

export const isValidHttpURL = (value: string) => {
  const res = value.match(/^http(s)?\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,6}(\/\S*)?$/);
  return res !== null;
};
