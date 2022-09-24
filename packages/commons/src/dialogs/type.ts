import { DialogProps as MuiDialogProps } from '@mui/material/Dialog';
import { Options as ModalProviderOptions } from 'mui-modal-provider';
import React from 'react';
export declare type ModalComponentProps<P> = Omit<P, 'open'>;

export type SeverityType = 'error' | 'info' | 'success' | 'warning';
export interface IDialogAction {
  action: string;
  label?: string;
  variant?: 'contained' | 'outlined' | 'text';
}

//@ts-ignore
export interface IDialog extends Partial<MuiDialogProps> {
  actions?: IDialogAction[];
  onBeforeClose?: (action?: string) => Promise<boolean>;
  onClose?: <T>(action?: string, data?: T) => void;
  preventEscape?: boolean;
  severity?: SeverityType;
  title?: string;
}

export type DialogType = 'simple' | 'templates';

interface ISimpleDialogMessage {
  onClose?: <T>(action?: string, data?: T) => void;
  data?: { [key: string]: any };
  onChangeData?: (data: { [key: string]: any }) => void;
}

export interface ISimpleDialog extends IDialog {
  Message?: React.FC<ISimpleDialogMessage> | string;
}

export type DialogProps = ISimpleDialog;

export interface IDialogBar {
  dismissed?: boolean;
  displayId?: string;
  options?: ModalProviderOptions;
  props?: ModalComponentProps<DialogProps>;
  type?: DialogType;
}
