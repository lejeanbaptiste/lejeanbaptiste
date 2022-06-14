import { derived } from 'overmind';
import type {
  AlertDialog,
  AllowedMimeType,
  DialogType,
  ISelectedItem,
  ISourcePanelOption,
  IValidate,
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
  selectedItem?: ISelectedItem;
  source: StorageSource;
  sources: ISourcePanelOption[];
  submit?: Submit;
  validate?: IValidate;
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
