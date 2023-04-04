import type { DialogBarProps } from '../../dialogs';
import type { Language } from '../../types';
import { supportedLanguages } from '../../utilities';

type State = {
  darkMode: boolean;
  dialogBar: DialogBarProps[];
  language: Language;
};

export const state: State = {
  darkMode: false,
  dialogBar: [],
  language: supportedLanguages['en-CA'],
};
