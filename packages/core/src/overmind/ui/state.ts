import type { IEditSourceDialogProps } from '../../components/editSource';
import type { EntityLookupDialogProps } from '../../components/entityLookups/types';
import type { PopupProps } from '../../components/popup';
import type { ContextMenuState, Language } from '../../types';

type State = {
  contextMenu: ContextMenuState;
  darkMode: boolean;
  editSourceProps: IEditSourceDialogProps;
  entityLookupDialogProps: EntityLookupDialogProps;
  language: Language;
  popupProps: PopupProps;
  settingsDialogOpen: boolean;
  themeAppearance: 'light' | 'auto' | 'dark';
  title: string;
};

export const state: State = {
  contextMenu: { show: false },
  darkMode: false,
  editSourceProps: { open: false },
  entityLookupDialogProps: { open: false },
  language: { code: 'en-CA', name: 'english', shortName: 'en' },
  popupProps: { open: false },
  settingsDialogOpen: false,
  themeAppearance: 'auto',
  title: 'Leaf Writer',
};
