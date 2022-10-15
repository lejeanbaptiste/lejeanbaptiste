import type { IDialogBar } from '../../dialogs';
import type { Language } from '../../types';
import { supportedLanguages } from '../../utilities';

type State = {
  darkMode: boolean;
  dialogBar: IDialogBar[];
  language: Language;
  publicRepositoriesLimit: Readonly<number>;
};

export const state: State = {
  darkMode: false,
  dialogBar: [],
  language: supportedLanguages['en-CA'],
  publicRepositoriesLimit: 5,
};
