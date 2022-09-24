import type { PopupProps } from '../../components';
import type { IDialogBar } from '../../dialogs';
import type { IEditSourceDialogProps, EntityLookupDialogProps } from '../../dialogs';
import type { ContextMenuState, Language, INotification } from '../../types';

type State = {
  contextMenu: ContextMenuState;
  darkMode: boolean;
  dialogBar: IDialogBar[];
  editSourceProps: IEditSourceDialogProps;
  entityLookupDialogProps: EntityLookupDialogProps;
  notifications: INotification[];
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
