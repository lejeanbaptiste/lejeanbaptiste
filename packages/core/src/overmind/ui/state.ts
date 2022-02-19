import { ContextMenuState, Language, PaletteMode } from '@src/@types';
import type { PopupProps } from '../../components/popup';
import type { IEditSourceDialogProps } from '../../components/editSource';
import { EntityLookupDialogProps } from '../../components/entityLookups/types';

type State = {
  contextMenu: ContextMenuState;
  darkMode: boolean;
  editSourceProps: IEditSourceDialogProps;
  language: Language;
  popupProps: PopupProps;
  themeAppearance: 'light' | 'auto' | 'dark';
  title: string;

  entityLookupDialogProps: EntityLookupDialogProps;
};

export const state: State = {
  contextMenu: { show: false },
  darkMode: false,
  editSourceProps: { open: false },
  language: { code: 'en-CA', name: 'english', shortName: 'en' },
  popupProps: { open: false },
  themeAppearance: 'auto',
  title: 'Leaf Writer',

  entityLookupDialogProps: { open: false },
};
