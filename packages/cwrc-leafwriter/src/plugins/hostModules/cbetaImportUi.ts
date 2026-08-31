import { CbetaImportDialog, isCbetaImportAvailable } from '../../dialogs/cbetaImport';
import { getPluginDialog } from '../pluginExtensions';
import { isPluginEnabled } from '../registry';
import type { PluginRegisterContext } from '../registerContext';

const openCbetaDialog = (): boolean => {
  if (!getPluginDialog('cbetaImport')) return false;
  const dialog = { type: 'cbetaImport' };
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

/** Registers the File-menu wizard for CBETA import. */
export function registerCbetaImportUi(context: PluginRegisterContext): void {
  context.log('registering CBETA import UI');
  context.registerDialog('cbetaImport', CbetaImportDialog);

  const openImport = ({ notify }: { notify: (message: string) => void }) => {
    if (!isPluginEnabled('cbeta-import')) {
      notify('Enable the “CBETA import” plugin in Tools → Plugins.');
      return;
    }
    if (!isCbetaImportAvailable()) {
      notify('CBETA import is available in the desktop app.');
      return;
    }
    const project = window.__leafWriterProject;
    if (!project?.isProjectReady?.() || !project.getProjectRootPath?.()) {
      notify('Open a project first.');
      return;
    }
    if (openCbetaDialog()) return;
    const msg =
      'CBETA import is not ready yet — restart the app or check the console for plugin load errors.';
    notify(msg);
    hostNotify(msg);
  };

  context.registerToolAction('cbeta-import.open', openImport);
}
