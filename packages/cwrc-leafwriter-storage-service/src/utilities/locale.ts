import i18next, { localesSchema, type Locales } from '../i18n';
import { getFromLocalStorage } from './local-storage';

export const updateLocale = async (locale?: string) => {
  const prefLocale = locale ?? getFromLocalStorage<string>('i18nextLng');
  if (!prefLocale) return;

  const supportedLocaled = localesSchema.safeParse(prefLocale).success
    ? (prefLocale as Locales)
    : 'en';

  if (i18next.language !== supportedLocaled) await i18next.changeLanguage(supportedLocaled);
};
