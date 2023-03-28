import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en-CA.json';
import fr from './locales/fr-CA.json';

export const resources = { en, fr } as const;

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // debug: true,
    defaultNS: 'commons',
    fallbackLng: 'en-CA',
    ns: [
      'commons',
      'cookie_consent',
      'error',
      'home',
      'language',
      'profile',
      'storage',
      'templates',
    ],
    resources,
    returnEmptyString: false,
  });
