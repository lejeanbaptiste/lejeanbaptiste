import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import z from 'zod';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

export const resources = { en, es, fr, pt, de } as const;

export const locales = ['en', 'fr', 'de', 'es', 'pt'] as const;
export const localesSchema = z.enum(locales);
export type Locales = z.infer<typeof localesSchema>;

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // debug: true,
    defaultNS: 'LWC',
    fallbackLng: ['en', 'fr'],
    ns: ['LWC'],
    nsSeparator: '.',
    resources,
    returnEmptyString: false,
    supportedLngs: locales,
  });
