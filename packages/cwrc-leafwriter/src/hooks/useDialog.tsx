import { useModal } from 'mui-modal-provider';
import { useEffect } from 'react';
import {
  EditSchemaDialog,
  EditSourceDialog,
  Popup,
  SelectSchemaDialog,
  SettingsDialog,
  SimpleDialog,
  type DialogProps,
  type DialogType,
} from '../dialogs';
import { useActions, useAppState } from '../overmind';

let displayed: string[] = [];

export const useDialog = () => {
  const { dialogBar } = useAppState().ui;
  const { removeDialog, setDialogDisplayId } = useActions().ui;

  const { showModal, destroyModal } = useModal();

  const storeDisplayed = (id: string) => {
    displayed = [...displayed, id];
  };

  const removeDisplayed = (id: string) => {
    displayed = [...displayed.filter((key) => id !== key)];
  };

  useEffect(() => {
    dialogBar.forEach(({ dismissed = false, displayId, options, props, type }) => {
      if (!props?.id) return;

      if (dismissed && displayId) {
        destroyModal(displayId);
        removeDisplayed(displayId);
        removeDialog(props.id);
        return;
      }

      if (displayId && displayed.includes(displayId)) return;

      const component = getComponent(type);
      if (!component) return;

      // display dialog
      const { id } = showModal<DialogProps>(
        component,
        {
          ...props,
          onClose: (action, data) => {
            if (props.onClose) props.onClose(action, data);
            if (displayId) removeDisplayed(displayId);
            if (props.id) removeDialog(props.id);
          },
        },
        options,
      );

      storeDisplayed(id);
      setDialogDisplayId({ id: props.id, displayId: id });
    });
  }, [dialogBar]);

  const getComponent = (type: DialogType) => {
    if (type === 'simple') return SimpleDialog;
    if (type === 'selectSchema') return SelectSchemaDialog;
    if (type === 'editSchema') return EditSchemaDialog;
    if (type === 'editSource') return EditSourceDialog;
    if (type === 'settings') return SettingsDialog;
    if (type === 'popup') return Popup;
  };
};
