import type { IDialogBar } from '@src/dialogs';
import type { INotification, Language, PaletteMode } from '@src/types';
import { supportedLanguages } from '@src/utilities';

type State = {
  cookieConsent: string[];
  darkMode: boolean;
  dialogBar: IDialogBar[];
  language: Language;
  notifications: INotification[];
  page: string;
  themeAppearance: PaletteMode;
};

export const state: State = {
  cookieConsent: [''],
  darkMode: false,
  dialogBar: [],
  language: supportedLanguages.get('en-CA')!,
  notifications: [],
  page: 'home',
  themeAppearance: 'auto',
};
