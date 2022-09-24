import { INotification, Language, PaletteMode } from '@src/types';
import { supportedLanguages } from '@src/utilities';
import type { IDialogBar } from '../../dialogs';

type State = {
  darkMode: boolean;
  dialogBar: IDialogBar[];
  language: Language;
  notifications: INotification[];
  themeAppearance: PaletteMode;
};

export const state: State = {
  darkMode: false,
  dialogBar: [],
  language: supportedLanguages.get('en-CA')!,
  notifications: [],
  themeAppearance: 'auto',
};
