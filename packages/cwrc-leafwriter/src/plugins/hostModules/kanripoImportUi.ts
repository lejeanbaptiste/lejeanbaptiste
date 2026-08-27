import { KanripoImportDialog, isKanripoImportAvailable } from '../../dialogs/kanripoImport';
import { isPluginEnabled } from '../registry';
import type { PluginRegisterContext } from '../registerContext';

/** Registers File-menu wizard and editor punctuate command for Kanripo import. */
export function registerKanripoImportUi(context: PluginRegisterContext): void {
  context.log('registering Kanripo import UI');
  context.registerDialog('kanripoImport', KanripoImportDialog);

  const openImport = async ({ notify }: { notify: (message: string) => void }) => {
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
    if (window.writer) {
      window.writer.overmindActions.ui.openDialog({ type: 'kanripoImport' });
      return;
    }
    notify('Kanripo import is not ready yet.');
  };

  const openPunctuate = async ({ notify }: { notify: (message: string) => void }) => {
    if (!isPluginEnabled('kanripo-import')) {
      notify('Enable the “Kanripo import” plugin in Tools → Plugins.');
      return;
    }
    if (!window.__leafWriterProject?.getActiveFileXml?.()) {
      notify('Open a document first.');
      return;
    }
    if (window.writer) {
      window.writer.overmindActions.ui.openDialog({
        type: 'kanripoImport',
        props: { variant: 'punctuate' },
      });
      return;
    }
    notify('Open a document in the editor first.');
  };

  context.registerToolAction('kanripo-import.open', openImport);
  context.registerToolAction('kanripo-import.punctuate', openPunctuate);

  context.registerToolbarItem({
    id: 'kanripo-punctuate',
    icon: 'entitiesTag',
    title: 'Segment and punctuate',
    tooltip: 'Copy punctuation from a parallel onto the overlapping stretch',
    group: 'ui',
    isAvailable: () => isPluginEnabled('kanripo-import') && isKanripoImportAvailable(),
    onClick: () => {
      void openPunctuate({
        notify: (message) => window.writer?.overmindActions?.ui?.notifyViaSnackbar?.(message),
      });
    },
  });
}
