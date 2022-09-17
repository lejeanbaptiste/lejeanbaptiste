import { useModal } from 'mui-modal-provider';
import { useEffect } from 'react';
import { EditSchemaDialog, SelectSchemaDialog, SimpleDialog } from '../dialogs';
import { DialogType } from '../dialogs/type';
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
      if (dismissed) {
        destroyModal(displayId);
        // removeDisplayed(displayId);
        // removeDialog(props.id);
        return;
      }

      if (displayed.includes(displayId)) return;

      const component = getComponent(type);
      if (!component) return;

      // display dialog
      // const { id } = showModal(component, props, options);
      const { id } = showModal(
        component,
        {
          ...props,
          onClose: (action, data) => {
            if (props.onClose) props.onClose(action, data);
            removeDisplayed(displayId);
            removeDialog(props.id);
          },
        },
        options
      );

      storeDisplayed(id);
      setDialogDisplayId({ id: props.id, displayId: id });
    });
  }, [dialogBar]);

  const getComponent = (type: DialogType) => {
    if (type === 'simple') return SimpleDialog;
    if (type === 'selectSchema') return SelectSchemaDialog;
    if (type === 'editSchema') return EditSchemaDialog;
  };
};
