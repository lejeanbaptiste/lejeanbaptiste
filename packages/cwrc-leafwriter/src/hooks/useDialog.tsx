import { useModal } from 'mui-modal-provider';
import { useEffect } from 'react';
import {
  AutoTaggingDialog,
  TagTransformDialog,
  ChineseAssetsDialog,
  EditSchemaDialog,
  EditSourceDialog,
  Popup,
  SelectSchemaDialog,
  SettingsDialog,
  PluginsDialog,
  SimpleDialog,
  XPathSearchDialog,
  type DialogProps,
  type DialogType,
} from '../dialogs';
import { getPluginDialog } from '../plugins/pluginExtensions';
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
      if (!component) {
        console.warn(`[dialog] No component registered for type "${type}"`);
        if (props?.id) removeDialog(props.id);
        return;
      }

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
    // Keyed to the dialog bar alone. `showModal`/`destroyModal` come from
    // mui-modal-provider and are rebuilt every render, so depending on them
    // would re-show every open dialog on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogBar]);

  const getComponent = (type: DialogType) => {
    if (type === 'simple') return SimpleDialog;
    if (type === 'selectSchema') return SelectSchemaDialog;
    if (type === 'editSchema') return EditSchemaDialog;
    if (type === 'editSource') return EditSourceDialog;
    if (type === 'settings') return SettingsDialog;
    if (type === 'plugins') return PluginsDialog;
    if (type === 'popup') return Popup;
    if (type === 'xpathSearch') return XPathSearchDialog;
    if (type === 'autoTagging') return AutoTaggingDialog;
    if (type === 'tagTransform') return TagTransformDialog;
    if (type === 'calendar') return getPluginDialog('calendar');
    if (type === 'kanripoImport') return getPluginDialog('kanripoImport');
    if (type === 'daozangImport') return getPluginDialog('daozangImport');
    if (type === 'chineseAssets') return ChineseAssetsDialog;
  };
};
