import type {
  AllowedMimeType,
  DialogType,
  ISourcePanelOption,
  MessageDialog,
  Resource,
  StorageSource,
  Submit,
  IValidate
} from '@src/@types/types';
import { derived } from 'overmind';

type State = {
  allowAllFileTypes: boolean;
  allowedFileTypes?: string[];
  allowedMimeTypes?: AllowedMimeType[];
  allowPaste?: boolean;
  dialogType: DialogType;
  messageDialog: MessageDialog;
  resource?: Resource;
  showInvisibleFiles: boolean;
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
      return parts[1];
    });
  }),
  dialogType: 'load',
  messageDialog: { open: false },
  showInvisibleFiles: false,
  source: 'local',
  sources: [],
};
