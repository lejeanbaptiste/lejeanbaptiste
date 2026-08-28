import { KanripoImportDialog, isKanripoImportAvailable } from '../../dialogs/kanripoImport';
import { isPluginEnabled } from '../registry';
import type { PluginRegisterContext } from '../registerContext';

const openKanripoDialog = (props?: { variant?: 'import' | 'punctuate' }): boolean => {
  const dialog = { type: 'kanripoImport', props };
  if (window.__ljbHostDialogBridge?.openDialog) {
    window.__ljbHostDialogBridge.openDialog(dialog);
    return true;
  }
  if (window.writer?.overmindActions?.ui?.openDialog) {
    window.writer.overmindActions.ui.openDialog({ type: 'kanripoImport', props });
    return true;
  }
  return false;
};

const hostNotify = (message: string): void => {
  window.__ljbHostDialogBridge?.notify?.(message);
  window.writer?.overmindActions?.ui?.notifyViaSnackbar?.(message);
};

/** Registers File-menu wizard and editor punctuate command for Kanripo import. */
export function registerKanripoImportUi(context: PluginRegisterContext): void {
  context.log('registering Kanripo import UI');
  context.registerDialog('kanripoImport', KanripoImportDialog);

  const openImport = ({ notify }: { notify: (message: string) => void }) => {
    if (!isPluginEnabled('kanripo-import')) {
      notify('Enable the “Kanripo import” plugin in Tools → Plugins.');
      return;
    }
    if (!isKanripoImportAvailable()) {
      notify('Kanripo import is available in the desktop app.');
      return;
    }
    const project = window.__leafWriterProject;
    if (!project?.isProjectReady?.() || !project.getProjectRootPath?.()) {
      notify('Open a project first.');
      return;
    }
    if (openKanripoDialog()) return;
    notify('Kanripo import is not ready yet — try again in a moment.');
  };

  const openPunctuate = ({ notify }: { notify: (message: string) => void }) => {
    if (!isPluginEnabled('kanripo-import')) {
      notify('Enable the “Kanripo import” plugin in Tools → Plugins.');
      return;
    }
    if (!window.__leafWriterProject?.getActiveFileXml?.()) {
      notify('Open a document first.');
      return;
    }
    if (openKanripoDialog({ variant: 'punctuate' })) return;
    notify('Open a document in the editor first.');
  };

  context.registerToolAction('kanripo-import.open', openImport);
  context.registerToolAction('kanripo-import.punctuate', openPunctuate);

  context.registerToolbarItem({
    id: 'kanripo-punctuate',
    icon: 'entitiesTag',
    title: 'Segment and punctuate',
    tooltip: 'Copy punctuation from a parallel onto the open file only',
    group: 'ui',
    isAvailable: () => isPluginEnabled('kanripo-import') && isKanripoImportAvailable(),
    onClick: () => {
      openPunctuate({ notify: hostNotify });
    },
  });
}

declare global {
  interface Window {
    __ljbHostDialogBridge?: {
      openDialog: (dialog: { type: string; props?: Record<string, unknown> }) => void;
      notify: (message: string) => void;
    };
  }
}
