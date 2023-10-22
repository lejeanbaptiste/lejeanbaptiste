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

export interface IDialog extends Partial<Omit<MuiDialogProps, 'onClose'>> {
  actions?: DialogActionProps[];
  onBeforeClose?: (action?: string) => Promise<boolean>;
  onClose?: <T>(action: string, data?: T) => Promise<void> | void;
  preventEscape?: boolean;
  severity?: SeverityType;
  title?: string;
}

export type DialogType = 'simple';

interface SimpleDialogMessageProps {
  onClose?: <T>(action?: string, data?: T) => void;
  data?: Record<string, unknown>;
  onChangeData?: (data: Record<string, unknown>) => void;
}

export interface SimpleDialogProps extends IDialog {
  Body?: React.FC<SimpleDialogMessageProps> | string;
}

export type DialogProps = IDialog & SimpleDialogProps;

export interface DialogBarProps {
  dismissed?: boolean;
  displayId?: string;
  options?: ModalProviderOptions;
  props?: ModalComponentProps<DialogProps>;
  type?: DialogType;
}
