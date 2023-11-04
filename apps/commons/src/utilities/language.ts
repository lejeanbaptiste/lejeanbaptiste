import { type Language } from '@src/types';

export const supportedLanguages = new Map<string, Language>([
  ['en-CA', { code: 'en-CA', name: 'english', shortName: 'en' }],
  ['fr-CA', { code: 'fr-CA', name: 'french', shortName: 'fr' }],
]);
