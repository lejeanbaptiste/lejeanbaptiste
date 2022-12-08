import { DialogProps as MuiDialogProps } from '@mui/material/Dialog';
import { Options as ModalProviderOptions } from 'mui-modal-provider';
import React from 'react';
export declare type ModalComponentProps<P> = Omit<P, 'open'>;

export type SeverityType = 'error' | 'info' | 'success' | 'warning';
export interface DialogActionProps {
  action: string;
  label?: string;
  variant?: 'contained' | 'outlined' | 'text';
}

//@ts-ignore
export interface IDialog extends Partial<MuiDialogProps> {
  actions?: DialogActionProps[];
  onBeforeClose?: (action?: string) => Promise<boolean>;
  onClose?: <T>(action?: string, data?: T) => void;
  preventEscape?: boolean;
  severity?: SeverityType;
  title?: string;
}

export type DialogType = 'privacy' | 'signIn' | 'simple' | 'templates';

interface SimpleDialogMessageProps {
  onClose?: <T>(action?: string, data?: T) => void;
  data?: { [key: string]: any };
  onChangeData?: (data: { [key: string]: any }) => void;
}

export interface SimpleDialogProps extends IDialog {
  Message?: React.FC<SimpleDialogMessageProps> | string;
}

export type DialogProps = SimpleDialogProps;

export interface DialogBarProps {
  dismissed?: boolean;
  displayId?: string;
  options?: ModalProviderOptions;
  props?: ModalComponentProps<DialogProps>;
  type?: DialogType;
}
