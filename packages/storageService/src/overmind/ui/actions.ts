import { supportedLanguages } from '../../utilities/util';
import i18next from '../../i18n';
import { Context } from '../';

//* INIITIALIZE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onInitializeOvermind = async ({ state }: Context, overmind: any) => {
  //DARK MODE
  const prefDarkMode = localStorage.getItem('darkMode');
  const darkMode = prefDarkMode === 'true' ? true : false;
  state.ui.darkMode = darkMode;

  //LANGUAGE
  const prefLanguageCode = localStorage.getItem('i18nextLng');
  if (prefLanguageCode) {
    const prefLanguage = supportedLanguages[prefLanguageCode];
    state.ui.language = prefLanguage ? prefLanguage : supportedLanguages['en-CA'];

    i18next.changeLanguage(state.ui.language.code);
  }
};

export const updateTranslation = ({ state }: Context, value?: string) => {
  const prefLanguageCode = value ? value : localStorage.getItem('i18nextLng');

  if (prefLanguageCode) {
    const prefLanguage = supportedLanguages[prefLanguageCode];
    state.ui.language = prefLanguage ? prefLanguage : supportedLanguages['en-CA'];

    if (i18next.language !== state.ui.language.code) i18next.changeLanguage(state.ui.language.code);
  }
};
