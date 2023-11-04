import { DialogProps as MuiDialogProps } from '@mui/material/Dialog';
import { IconName } from '@src/icons';
import { Options as ModalProviderOptions } from 'mui-modal-provider';
export declare type ModalComponentProps<P> = Omit<P, 'open'>;

export type SeverityType = 'error' | 'info' | 'success' | 'warning';
export interface DialogActionProps {
  action: string;
  label?: string;
  variant?: 'contained' | 'outlined' | 'text';
}

export interface IDialog extends Partial<Omit<MuiDialogProps, 'onClose'>> {
  actions?: DialogActionProps[];
  icon?: IconName;
  onBeforeClose?: (action?: string) => Promise<boolean | void>;
  onClose?: <T>(action?: string, data?: T) => void;
  preventEscape?: boolean;
  severity?: SeverityType;
  title?: string;
  type?: DialogType;
}

export type DialogType = 'export' | 'import' | 'privacy' | 'signIn' | 'simple' | 'templates';

interface SimpleDialogMessageProps {
  data?: Record<string, unknown>;
  onChangeData?: (data: Record<string, unknown>) => void;
}

export interface SimpleDialogProps extends IDialog {
  Body?: React.FC<SimpleDialogMessageProps> | string;
}

export type DialogProps = SimpleDialogProps;

export interface DialogBarProps {
  dismissed?: boolean;
  displayId?: string;
  options?: ModalProviderOptions;
  props?: ModalComponentProps<DialogProps>;
  type?: DialogType;
}
