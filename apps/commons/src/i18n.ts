import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import z from 'zod';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ro from './locales/ro.json';

export const locales = ['en', 'fr', 'es', 'pt', 'de', 'ro'] as const;
export const localesSchema = z.enum(locales);
export type Locales = z.infer<typeof localesSchema>;

export const resources = { en, es, fr, pt, de, ro } as const;

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
