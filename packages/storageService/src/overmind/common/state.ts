import { derived } from 'overmind';
import type {
  AlertDialog,
  AllowedMimeType,
  DialogType,
  MessageDialog,
  Resource,
  SelectedItem,
  SourcePanelOption,
  StorageSource,
  Submit,
  Validate,
} from '../../types';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type State = {
  allowAllFileTypes: boolean;
  allowedFileTypes?: string[];
  allowLocalFiles?: boolean;
  allowedMimeTypes?: AllowedMimeType[];
  allowPaste?: boolean;
  allowUrl?: boolean;
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
