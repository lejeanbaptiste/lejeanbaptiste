import type {
  DialogBarProps,
  EditSourceDialogProps,
  EntityLookupDialogProps,
  PopupProps,
} from '../../dialogs';
import { panel } from '../../layout/Utilities';
import type { ContextMenuState, Language, LayoutProps, NotificationProps } from '../../types';

type State = {
  contextMenu: ContextMenuState;
  darkMode: boolean;
  dialogBar: DialogBarProps[];
  editSourceProps: EditSourceDialogProps;
  entityLookupDialogProps: EntityLookupDialogProps;
  fullscreen: boolean;
  language: Language;
  layout: LayoutProps;
  markupPanel: {
    allowDragAndDrop: boolean;
    allowMultiselection: boolean;
    showTextNodes: boolean;
    showTextNodesContent: boolean;
  };
  notifications: NotificationProps[];
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
  fullscreen: false,
  language: { code: 'en-CA', name: 'english', shortName: 'en' },
  layout: {
    outerLeft: { id: 'left', items: [panel.toc, panel.structure, panel.entities] },
    left: { activePanel: 'structure', id: 'left', panels: ['toc', 'structure', 'entities'] },
    right: {
      activePanel: 'imageViewer',
      collapsed: true,
      id: 'right',
      panels: ['imageViewer', 'xmlViewer', 'validate'],
    },
    outerRight: {
      id: 'right',
      items: [panel.imageViewer, panel.xmlViewer, panel.validate],
    },
  },
  markupPanel: {
    allowDragAndDrop: false,
    allowMultiselection: true,
    showTextNodes: false,
    showTextNodesContent: false,
  },
  notifications: [],
  popupProps: { open: false },
  settingsDialogOpen: false,
  themeAppearance: 'auto',
  title: 'LEAF-Writer',
};
