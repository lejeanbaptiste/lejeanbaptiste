import i18next from 'i18next';
import z from 'zod';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ro from './locales/ro.json';
import { log } from './utilities';

export const resources = { en, es, fr, pt, de, ro } as const;

export const locales = ['en', 'fr', 'es', 'pt', 'de', 'ro'] as const;
export const localesSchema = z.enum(locales);
export type Locales = z.infer<typeof localesSchema>;

//https://luxiyalu.com/how-to-have-multiple-instances-of-i18next-for-component-library/

// Note that we are using createInstance here
const i18n = i18next.createInstance(
  {
    lng: 'en',
    fallbackLng: ['en', 'fr'],
    defaultNS: 'SS',
    ns: ['SS'],
    nsSeparator: '.',
    react: { useSuspense: false },
    // interpolation: { escapeValue: false },
    // debug: true,
    resources,
    returnEmptyString: false,
    supportedLngs: locales,
  },
  // We must provide a function as second parameter, otherwise i18next errors
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (error, _t) => {
    if (error) return log.error(error);
  },
);

export default i18n;
