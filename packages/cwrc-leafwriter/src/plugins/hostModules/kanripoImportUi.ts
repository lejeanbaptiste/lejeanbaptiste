import { KanripoImportDialog, isKanripoImportAvailable } from '../../dialogs/kanripoImport';
import { isPluginEnabled } from '../registry';
import type { PluginRegisterContext } from '../registerContext';

/** Registers File-menu wizard for cloning Kanripo works into project TEI. */
export function registerKanripoImportUi(context: PluginRegisterContext): void {
  context.log('registering Kanripo import UI');
  context.registerDialog('kanripoImport', KanripoImportDialog);

  context.registerToolAction('kanripo-import.open', async ({ notify }) => {
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
  });
}
