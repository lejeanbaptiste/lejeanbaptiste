import { useModal } from 'mui-modal-provider';
import { useEffect, type ComponentType } from 'react';
import {
  ChineseAssetsDialog,
  ImportDialog,
  PrivacyDialog,
  SignInDialog,
  SimpleDialog,
  TemplateDialog,
  WikisourceImportDialog,
  type DialogProps,
  type DialogType,
} from '../dialogs';
import { getPluginDialog } from '../../../../packages/cwrc-leafwriter/src/plugins/pluginExtensions';
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
            if (!props.id) return;
            removeDialog(props.id);
          },
          type,
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

  /** Plugin dialogs are registered at runtime, so their props cannot be checked statically here. */
  const pluginDialog = (type: string) =>
    getPluginDialog(type) as ComponentType<DialogProps> | undefined;

  const getComponent = (type?: DialogType): ComponentType<DialogProps> | undefined => {
    if (!type) return SimpleDialog;
    if (type === 'export' || type === 'import') return ImportDialog;
    if (type === 'simple') return SimpleDialog;
    if (type === 'templates') return TemplateDialog;
    if (type === 'privacy') return PrivacyDialog;
    if (type === 'signIn') return SignInDialog;
    if (type === 'chineseAssets') return ChineseAssetsDialog;
    if (type === 'kanripoImport') return pluginDialog('kanripoImport');
    if (type === 'daozangImport') return pluginDialog('daozangImport');
    if (type === 'cbetaImport') return pluginDialog('cbetaImport');
    if (type === 'bdrcImport') return pluginDialog('bdrcImport');
    if (type === 'wikisourceImport') {
      return WikisourceImportDialog as ComponentType<DialogProps>;
    }
  };
};
