import type {
  DialogBarProps,
  EditSourceDialogProps,
  EntityLookupDialogProps,
  PopupProps,
} from '../../dialogs';
import type { ContextMenuState, Language, NotificationProps } from '../../types';

type State = {
  contextMenu: ContextMenuState;
  darkMode: boolean;
  dialogBar: DialogBarProps[];
  editSourceProps: EditSourceDialogProps;
  entityLookupDialogProps: EntityLookupDialogProps;
  fullscreen: boolean;
  notifications: NotificationProps[];
  language: Language;
  popupProps: PopupProps;
  settingsDialogOpen: boolean;
  structurePanel: {
    allowDragAndDrop: boolean;
    allowMultiselection: boolean;
    showTextNodes: boolean;
    showTextNodesContent: boolean;
  };
  themeAppearance: 'light' | 'auto' | 'dark';
  title: string;
};

export const state: State = {
  contextMenu: { show: false },
  darkMode: false,
  dialogBar: [],
  editSourceProps: { open: false },
  entityLookupDialogProps: { open: false },
  fullscreen: false,
  language: { code: 'en-CA', name: 'english', shortName: 'en' },
  notifications: [],
  popupProps: { open: false },
  settingsDialogOpen: false,
  structurePanel: {
    allowDragAndDrop: false,
    allowMultiselection: true,
    showTextNodes: false,
    showTextNodesContent: false,
  },
  themeAppearance: 'auto',
  title: 'LEAF-Writer',
};
