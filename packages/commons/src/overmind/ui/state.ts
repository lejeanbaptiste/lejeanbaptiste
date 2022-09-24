import { AlertDialog, INotification, Language, MessageDialog, PaletteMode } from '@src/types';
import { supportedLanguages } from '@src/utilities';

type State = {
  alertDialog: AlertDialog;
  darkMode: boolean;
  language: Language;
  messageDialog: MessageDialog;
  notifications: INotification[];
  themeAppearance: PaletteMode;
};

export const state: State = {
  alertDialog: { open: false },
  darkMode: false,
  language: supportedLanguages.get('en-CA')!,
  messageDialog: { open: false },
  notifications: [],
  themeAppearance: 'auto',
};
