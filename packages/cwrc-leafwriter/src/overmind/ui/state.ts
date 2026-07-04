import type { DialogBarProps, EditSourceDialogProps, PopupProps } from '../../dialogs';
import { type Locales } from '../../i18n';
import { Panel } from '../../layout/Utilities';
import type { ContextMenuState, LayoutProps, NotificationProps, PaletteMode } from '../../types';

export type EditorViewMode = 'visual' | 'source';

export interface TranslationModeState {
  active: boolean;
  lang: string | null;
  sourcePath: string | null;
  translationPath: string | null;
  alignmentUnit: 'div' | 'p' | null;
  /** CSL style id for footnote citations (null → app default). */
  citationStyle: string | null;
  selectedUnitId: string | null;
}

export interface AutoTaggingReviewState {
  active: boolean;
}

export interface DisambiguationReviewState {
  active: boolean;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type State = {
  contextMenu: ContextMenuState;
  currentLocale: Locales;
  darkMode: boolean;
  dialogBar: DialogBarProps[];
  editSourceProps: EditSourceDialogProps;
  editorViewMode: EditorViewMode;
  translationMode: TranslationModeState;
  autoTaggingReview: AutoTaggingReviewState;
  disambiguationReview: DisambiguationReviewState;
  sourceCurrentContent: string;
  sourceOriginalContent: string;
  sourcePendingCursorOffset: number | null;
  fullscreen: boolean;
  layout: LayoutProps;
  markupPanel: {
    allowDragAndDrop: boolean;
    showTextNodes: boolean;
  };
  notifications: NotificationProps[];
  popupProps: PopupProps;
  settingsDialogOpen: boolean;
  themeAppearance: PaletteMode;
};

export const state: State = {
  contextMenu: { show: false },
  currentLocale: 'en',
  darkMode: false,
  dialogBar: [],
  editSourceProps: { open: false },
  editorViewMode: 'visual',
  translationMode: {
    active: false,
    lang: null,
    sourcePath: null,
    translationPath: null,
    alignmentUnit: null,
    citationStyle: null,
    selectedUnitId: null,
  },
  autoTaggingReview: {
    active: false,
  },
  disambiguationReview: {
    active: false,
  },
  sourceCurrentContent: '',
  sourceOriginalContent: '',
  sourcePendingCursorOffset: null,
  fullscreen: false,
  layout: {
    outerLeft: { id: 'left', items: [Panel.toc, Panel.markup, Panel.entities] },
    left: { activePanel: 'markup', id: 'left', panels: ['toc', 'markup', 'entities'] },
    right: {
      activePanel: 'imageViewer',
      collapsed: true,
      id: 'right',
      panels: ['imageViewer', 'xmlViewer', 'validate'],
    },
    outerRight: {
      id: 'right',
      items: [Panel.imageViewer, Panel.xmlViewer, Panel.validate],
    },
  },
  markupPanel: {
    allowDragAndDrop: false,
    showTextNodes: false,
  },
  notifications: [],
  popupProps: { open: false },
  settingsDialogOpen: false,
  themeAppearance: 'system',
};
