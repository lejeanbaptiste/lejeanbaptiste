let currentLocale = 'en';

export const getAppLocale = (): string => currentLocale;

export const setAppLocale = (locale: string): void => {
  currentLocale = locale;
};
