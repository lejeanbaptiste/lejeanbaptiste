import i18next from '../i18n';
import { getFromLocalStorage } from './localStorage';

export type LanguageCode = 'en-CA' | 'fr-CA';
export interface Language {
  code: string;
  name: string;
  shortName: string;
}

export type Languages = Record<LanguageCode, Language>;

export const supportedLanguages: Languages = {
  'en-CA': { code: 'en-CA', name: 'english', shortName: 'en' },
  'fr-CA': { code: 'fr-CA', name: 'french', shortName: 'fr' },
};

export const updateTranslation = async (code?: string) => {
  const prefLanguageCode = code ?? getFromLocalStorage<string>('i18nextLng');
  if (!prefLanguageCode) return;

  const prefLanguage = supportedLanguages[prefLanguageCode];
  const language = prefLanguage ? prefLanguage : supportedLanguages['en-CA'];
  if (i18next.language !== language.code) await i18next.changeLanguage(language.code);
};
