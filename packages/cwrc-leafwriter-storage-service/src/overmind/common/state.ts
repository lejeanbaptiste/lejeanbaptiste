import type {
  AlertDialog,
  MimeTypeSupported,
  DialogType,
  MessageDialog,
  Resource,
  SelectedItem,
  SourcePanelOption,
  StorageSource,
  Submit,
  Validate,
} from '@src/types';
import { derived } from 'overmind';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type State = {
  allowAllFileTypes: boolean;
  allowedFileTypes?: string[];
  allowLocalFiles?: boolean;
  allowedMimeTypes?: MimeTypeSupported[];
  allowPaste?: boolean;
  allowUrl?: boolean;
  contentToSave?: string;
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
      if (parts[1] === 'plain') return 'txt';
      if (parts[1] === 'markdown') return 'md';
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
