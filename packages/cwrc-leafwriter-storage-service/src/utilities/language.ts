import i18next from '../i18n';
import { getFromLocalStorage } from './localStorage';

export interface Language {
  code: string;
  name: string;
}

export type Languages = Record<string, Language>;

export const supportedLanguages: Languages = {
  en: { code: 'en', name: 'english' },
  fr: { code: 'fr', name: 'french' },
};

export const updateTranslation = async (code?: string) => {
  const prefLanguageCode = code ?? getFromLocalStorage<string>('i18nextLng');
  if (!prefLanguageCode) return;

  const prefLanguage = supportedLanguages[prefLanguageCode];
  const language = prefLanguage ? prefLanguage : supportedLanguages.en;
  if (i18next.language !== language.code) await i18next.changeLanguage(language.code);
};
