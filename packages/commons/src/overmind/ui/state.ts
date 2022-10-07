import { INotification, Language, PaletteMode } from '@src/types';
import { supportedLanguages } from '@src/utilities';
import type { IDialogBar } from '../../dialogs';

type State = {
  cookieConsent: string[];
  darkMode: boolean;
  dialogBar: IDialogBar[];
  language: Language;
  notifications: INotification[];
  themeAppearance: PaletteMode;
};

export const state: State = {
  cookieConsent: [''],
  darkMode: false,
  dialogBar: [],
  language: supportedLanguages.get('en-CA')!,
  notifications: [],
  themeAppearance: 'auto',
};
