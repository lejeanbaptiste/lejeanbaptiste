import i18next from 'i18next';
import en from './locales/en-CA.json';
import fr from './locales/fr-CA.json';

export const resources = { en, fr } as const;

//https://luxiyalu.com/how-to-have-multiple-instances-of-i18next-for-component-library/

// Note that we are using createInstance here
const i18n = i18next.createInstance(
  {
    lng: 'en-CA',
    fallbackLng: 'en-CA',
    // ns: ['translation'],
    // defaultNS: 'translation',
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
    resources,
  },
  // We must provide a function as second parameter, otherwise i18next errors
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (error, t) => {
    if (error) return console.log(error);
  }
);

export default i18n;
