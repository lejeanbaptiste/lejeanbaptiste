import type { DialogBarProps } from '@src/dialogs';
import { Locales } from '@src/i18n';
import type { NotificationProps, PaletteMode } from '@src/types';

interface State {
  cookieConsent: string[];
  currentLocale: Locales;
  darkMode: boolean;
  dialogBar: DialogBarProps[];
  notifications: NotificationProps[];
  page: string;
  themeAppearance: PaletteMode;
}

export const state: State = {
  cookieConsent: [''],
  currentLocale: 'en',
  darkMode: false,
  dialogBar: [],
  notifications: [],
  page: 'home',
  themeAppearance: 'system',
};
