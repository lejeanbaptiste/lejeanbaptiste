import { BdrcImportDialog, isBdrcImportAvailable } from '../../dialogs/bdrcImport';
import { getPluginDialog } from '../pluginExtensions';
import { isPluginEnabled } from '../registry';
import type { PluginRegisterContext } from '../registerContext';

const openBdrcDialog = (): boolean => {
  if (!getPluginDialog('bdrcImport')) return false;
  const dialog = { type: 'bdrcImport' };
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

/** Registers the File-menu wizard for BDRC import. */
export function registerBdrcImportUi(context: PluginRegisterContext): void {
  context.log('registering BDRC import UI');
  context.registerDialog('bdrcImport', BdrcImportDialog);

  const openImport = ({ notify }: { notify: (message: string) => void }) => {
    if (!isPluginEnabled('bdrc-import')) {
      notify('Enable the “BDRC import” plugin in Tools → Plugins.');
      return;
    }
    if (!isBdrcImportAvailable()) {
      notify('BDRC import is available in the desktop app.');
      return;
    }
    const project = window.__leafWriterProject;
    if (!project?.isProjectReady?.() || !project.getProjectRootPath?.()) {
      notify('Open a project first.');
      return;
    }
    if (openBdrcDialog()) return;
    const msg =
      'BDRC import is not ready yet — restart the app or check the console for plugin load errors.';
    notify(msg);
    hostNotify(msg);
  };

  context.registerToolAction('bdrc-import.open', openImport);
}
