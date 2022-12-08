import type { DialogBarProps } from '@src/dialogs';
import type { NotificationProps, Language, PaletteMode } from '@src/types';
import { supportedLanguages } from '@src/utilities';

type State = {
  cookieConsent: string[];
  darkMode: boolean;
  dialogBar: DialogBarProps[];
  language: Language;
  notifications: NotificationProps[];
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
