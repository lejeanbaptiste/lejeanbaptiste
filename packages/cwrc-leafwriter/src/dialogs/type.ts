import type { ButtonProps } from '@mui/material';
import { DialogProps as MuiDialogProps } from '@mui/material/Dialog';
import { Options as ModalProviderOptions } from 'mui-modal-provider';
import type { Schema, SchemaMappingType } from '../types';
export declare type ModalComponentProps<P> = Omit<P, 'open'>;

export type SeverityType = 'error' | 'info' | 'success' | 'warning';
export interface DialogActionProps {
  action: string;
  label: string;
  variant?: ButtonProps['variant'];
}

export interface IDialog extends Partial<Omit<MuiDialogProps, 'onClose'>> {
  actions?: DialogActionProps[];
  id?: string;
  onBeforeClose?: (action?: string) => Promise<boolean>;
  onClose?: <T>(action?: string | undefined, data?: T) => Promise<void> | void;
  preventEscape?: boolean;
  severity?: SeverityType;
  title?: string;
  content?: string;
}

export type DialogType =
  | 'editSchema'
  | 'editSource'
  | 'popup'
  | 'selectSchema'
  | 'simple'
  | 'settings';

export interface SimpleDialogMessageProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChangeData?: (data: Record<string, any>) => void;
}

export interface SimpleDialogProps extends IDialog {
  Body?: React.FC<SimpleDialogMessageProps> | string;
}

export interface EditSchemaDialogProps extends IDialog {
  actionType?: 'add' | 'update';
  docSchema?: { rng?: string; css?: string };
  mappingIds?: SchemaMappingType[];
  onAcceptChanges?: (schema: Schema & Omit<Schema, 'id'>) => Promise<void>;
  onDelete?: (schemaId: string) => Promise<void>;
  schemaId?: string;
}

export interface EditSourceDialogProps extends IDialog {
  content?: string;
  type?: 'content' | 'header';
}

export type DialogProps = IDialog &
  SimpleDialogProps &
  EditSchemaDialogProps &
  EditSourceDialogProps;

export interface DialogBarProps {
  dismissed?: boolean;
  displayId?: string;
  options?: ModalProviderOptions;
  props?: ModalComponentProps<DialogProps>;
  type: DialogType;
}
