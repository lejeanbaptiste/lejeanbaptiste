import { DaozangImportDialog, isDaozangImportAvailable } from '../../dialogs/daozangImport';
import { getPluginDialog } from '../pluginExtensions';
import { isPluginEnabled } from '../registry';
import type { PluginRegisterContext } from '../registerContext';

const openDaozangDialog = (): boolean => {
  if (!getPluginDialog('daozangImport')) return false;
  const dialog = { type: 'daozangImport' };
  if (window.__ljbHostDialogBridge?.openDialog) {
    window.__ljbHostDialogBridge.openDialog(dialog);
    return true;
  }
  if (window.writer?.overmindActions?.ui?.openDialog) {
    window.writer.overmindActions.ui.openDialog(dialog);
    return true;
  }
  return false;
};

const hostNotify = (message: string): void => {
  window.__ljbHostDialogBridge?.notify?.(message);
  window.writer?.overmindActions?.ui?.notifyViaSnackbar?.(message);
};

/** Registers File-menu wizard for Daozang import. */
export function registerDaozangImportUi(context: PluginRegisterContext): void {
  context.log('registering Daozang import UI');
  context.registerDialog('daozangImport', DaozangImportDialog);

  const openImport = ({ notify }: { notify: (message: string) => void }) => {
    if (!isPluginEnabled('daozang-import')) {
      notify('Enable the “Daozang import” plugin in Tools → Plugins.');
      return;
    }
    if (!isDaozangImportAvailable()) {
      notify('Daozang import is available in the desktop app.');
      return;
    }
    const project = window.__leafWriterProject;
    if (!project?.isProjectReady?.() || !project.getProjectRootPath?.()) {
      notify('Open a project first.');
      return;
    }
    if (openDaozangDialog()) return;
    notify('Daozang import is not ready yet — restart the app or check the console for plugin load errors.');
    hostNotify('Daozang import is not ready yet — restart the app or check the console for plugin load errors.');
  };

  context.registerToolAction('daozang-import.open', openImport);
}

declare global {
  interface Window {
    __ljbHostDialogBridge?: {
      openDialog: (dialog: { type: string; props?: Record<string, unknown> }) => void;
      notify: (message: string) => void;
    };
  }
}
