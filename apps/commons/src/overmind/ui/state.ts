import type { DialogBarProps } from '@src/dialogs';
import { Locales } from '@src/i18n';
import type { NotificationProps, PaletteMode } from '@src/types';

export type DesktopWindowMode = 'editor' | 'database';

export interface State {
  cookieConsent: string[];
  currentLocale: Locales;
  darkMode: boolean;
  /** Full-width Database Window vs the normal editor layout. */
  desktopWindowMode: DesktopWindowMode;
  dialogBar: DialogBarProps[];
  notifications: NotificationProps[];
  page: string;
  skipCopyPasteHelp: boolean;
  skipEntityDetachConfirm: boolean;
  skipExplorerDeleteConfirm: boolean;
  themeAppearance: PaletteMode;
}

export const state: State = {
  cookieConsent: [''],
  currentLocale: 'en',
  darkMode: false,
  desktopWindowMode: 'editor',
  dialogBar: [],
  notifications: [],
  page: 'home',
  skipCopyPasteHelp: false,
  skipEntityDetachConfirm: false,
  skipExplorerDeleteConfirm: false,
  themeAppearance: 'system',
};
