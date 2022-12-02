import { derived } from 'overmind';
import type {
  AlertDialog,
  AllowedMimeType,
  DialogType,
  SelectedItem,
  SourcePanelOption,
  Validate,
  MessageDialog,
  Resource,
  StorageSource,
  Submit,
} from '../../types';

type State = {
  allowAllFileTypes: boolean;
  allowedFileTypes?: string[];
  allowedMimeTypes?: AllowedMimeType[];
  allowPaste?: boolean;
  dialogType: DialogType;
  alertDialog: AlertDialog;
  messageDialog: MessageDialog;
  resource?: Resource;
  showInvisibleFiles: boolean;
  selectedItem?: SelectedItem;
  source: StorageSource;
  sources: SourcePanelOption[];
  submit?: Submit;
  validate?: Validate;
};

export const state: State = {
  allowAllFileTypes: false,
  allowedFileTypes: derived((state: State) => {
    if (!state.allowedMimeTypes) return;
    return state.allowedMimeTypes.map((mimeType) => {
      const parts = mimeType.split('/');
      if (parts[1] === 'plain') return '';
      return parts[1];
    });
  }),
  dialogType: 'load',
  alertDialog: { open: false },
  messageDialog: { open: false },
  showInvisibleFiles: false,
  source: 'local',
  sources: [],
};
