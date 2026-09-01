import { createInstance } from 'i18next';
import type { i18n as I18n } from 'i18next';
import z from 'zod';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import zhHant from './locales/zh-Hant.json';
import ja from './locales/ja.json';
import { log } from './utilities';

export const resources = { en, es, fr, pt, de, 'zh-Hant': zhHant, ja } as const;

export const locales = ['en', 'fr', 'de', 'zh-Hant', 'ja'] as const;
export const localesSchema = z.enum(locales);
export type Locales = z.infer<typeof localesSchema>;

//https://luxiyalu.com/how-to-have-multiple-instances-of-i18next-for-component-library/

const i18n: I18n = createInstance(
  {
    // debug: true,
    defaultNS: 'LW',
    fallbackLng: ['en', 'fr'],
    // React already escapes every rendered text node, so i18next must not
    // double-escape interpolated values — its default turns `/` in a
    // localised date (`01/09/2026`) into a literal `&#x2F;`.
    interpolation: { escapeValue: false },
    lng: 'en',
    ns: ['LW'],
    nsSeparator: '.',
    react: { useSuspense: false },
    resources,
    returnEmptyString: false,
    showSupportNotice: false,
    supportedLngs: locales,
  },
  // We must provide a function as second parameter, otherwise i18next errors
  (error, _t) => {
    if (error) return log.error(error);
  },
);

// i18n.use(initReactI18next).init();

export default i18n;
