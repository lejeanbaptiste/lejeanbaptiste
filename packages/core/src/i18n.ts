import { createInstance } from 'i18next';
import en from './locales/en-CA.json';
import fr from './locales/fr-CA.json';
import { log } from './utilities';

export const resources = { en, fr } as const;


//https://luxiyalu.com/how-to-have-multiple-instances-of-i18next-for-component-library/

const i18n = createInstance(
  {
    // debug: true,
    defaultNS: 'leafwriter',
    fallbackLng: 'en-CA',
     // lng: 'en-CA',
    ns: ['leafwriter'],
    returnEmptyString: false,
    react: { useSuspense: false },
    resources,
  },
  // We must provide a function as second parameter, otherwise i18next errors
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (error, _t) => {
    if (error) return log.error(error);
  }
);

// i18n.use(initReactI18next).init();

export default i18n;


// import i18next from 'i18next';
// import LanguageDetector from 'i18next-browser-languagedetector';
// import { initReactI18next } from 'react-i18next';
// import en from './locales/en-CA.json';
// import fr from './locales/fr-CA.json';

// export const resources = { en, fr } as const;

// i18next
//   .use(LanguageDetector)
//   .use(initReactI18next)
//   .init({
//     // debug: true,
//     defaultNS: 'leafwriter',
//     fallbackLng: 'en-CA',
//     ns: [
//       'leafwriter',
//       'commons',
//     ],
//     resources,
//     returnEmptyString: false,
//   });
