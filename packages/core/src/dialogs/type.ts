import { DialogProps as MuiDialogProps } from '@mui/material/Dialog';
import { Options as ModalProviderOptions } from 'mui-modal-provider';
import React from 'react';
import type { Schema, SchemaMappingType } from '../types';
export declare type ModalComponentProps<P> = Omit<P, 'open'>;

export type SeverityType = 'error' | 'info' | 'success' | 'warning';
export interface IDialogAction {
  action: string;
  label?: string;
  variant?: 'contained' | 'outlined' | 'text';
}

export interface IDialog extends Partial<MuiDialogProps> {
  actions?: IDialogAction[];
  id?: string;
  onBeforeClose?: (action?: string) => Promise<boolean>;
  onClose?: <T>(action?: string, data?: T) => void;
  preventEscape?: boolean;
  severity?: SeverityType;
  title?: string;
}

export type DialogType =
  | 'editSchema'
  | 'editSource'
  | 'popup'
  | 'selectSchema'
  | 'simple'
  | 'settings';

interface ISimpleDialogMessage {
  data?: { [key: string]: any };
  onChangeData?: (data: { [key: string]: any }) => void;
}

export interface ISimpleDialog extends IDialog {
  Message?: React.FC<ISimpleDialogMessage> | string;
}

export interface IEditSchemaDialog extends IDialog {
  actionType?: 'add' | 'update';
  docSchema?: { rng?: string; css?: string };
  mappingIds?: SchemaMappingType[];
  onAcceptChanges?: (schema: Schema & Omit<Schema, 'id'>) => Promise<void>;
  onDelete?: (schemaId: string) => Promise<void>;
  schemaId?: string;
}

export type DialogProps = IDialog & ISimpleDialog & IEditSchemaDialog;

export interface IDialogBar {
  dismissed?: boolean;
  displayId?: string;
  options?: ModalProviderOptions;
  props?: ModalComponentProps<DialogProps>;
  type: DialogType;
}
