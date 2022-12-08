import type { PopupProps } from '../../dialogs';
import type { DialogBarProps } from '../../dialogs';
import type { EditSourceDialogProps, EntityLookupDialogProps } from '../../dialogs';
import type { ContextMenuState, Language, NotificationProps } from '../../types';

type State = {
  contextMenu: ContextMenuState;
  darkMode: boolean;
  dialogBar: DialogBarProps[];
  editSourceProps: EditSourceDialogProps;
  entityLookupDialogProps: EntityLookupDialogProps;
  notifications: NotificationProps[];
  language: Language;
  popupProps: PopupProps;
  settingsDialogOpen: boolean;
  themeAppearance: 'light' | 'auto' | 'dark';
  title: string;
};

export const state: State = {
  contextMenu: { show: false },
  darkMode: false,
  dialogBar: [],
  editSourceProps: { open: false },
  entityLookupDialogProps: { open: false },
  language: { code: 'en-CA', name: 'english', shortName: 'en' },
  notifications: [],
  popupProps: { open: false },
  settingsDialogOpen: false,
  themeAppearance: 'auto',
  title: 'LEAF-Writer',
};
