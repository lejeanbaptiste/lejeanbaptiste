import type { Language } from '../../@types/types';
import { supportedLanguages } from '../../utilities/util';

type State = {
  darkMode: boolean;
  language: Language;
  publicRepositoriesLimit: Readonly<number>;
};

export const state: State = {
  darkMode: false,
  language: supportedLanguages['en-CA'],
  publicRepositoriesLimit: 5,
};
