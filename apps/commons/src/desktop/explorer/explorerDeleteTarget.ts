import type { OpenTab } from '@src/overmind/project/state';
import type { TFunction } from 'i18next';
import type { ExplorerTarget } from '../sidebar/useExplorerContextMenu';

interface DeleteExplorerTargetOptions {
  activeTabPath: string | null;
  contentHasChanged: boolean;
  deleteExplorerItem: (path: string) => Promise<{ success: boolean; error?: string }>;
  openTabs: OpenTab[];
  skipDeleteConfirm: boolean;
  t: TFunction;
  target: ExplorerTarget;
}

export const deleteExplorerTarget = async ({
  activeTabPath,
  contentHasChanged,
  deleteExplorerItem,
  openTabs,
  skipDeleteConfirm,
  t,
  target,
}: DeleteExplorerTargetOptions): Promise<{ cancelled: boolean; error?: string }> => {
  if (!window.electronAPI?.showNativeMessageBox) {
    return { cancelled: true };
  }

  const prefix = target.isDirectory
    ? target.path.endsWith('/')
      ? target.path
      : `${target.path}/`
    : null;

  const affectedTabs = openTabs.filter((tab) => {
    if (tab.filePath === target.path) return true;
    return prefix ? tab.filePath.startsWith(prefix) : false;
  });

  for (const tab of affectedTabs) {
    const isActive = tab.filePath === activeTabPath;
    const isDirty = isActive ? contentHasChanged : tab.dirty;
    if (!isDirty) continue;

    const discardLabel = t('LWC.commons.discard changes');
    const cancelLabel = t('LWC.commons.cancel');
    const { response } = await window.electronAPI.showNativeMessageBox({
      buttons: [discardLabel, cancelLabel],
      cancelId: 1,
      defaultId: 0,
      message: t('LWC.desktop.close_unsaved.message', { filename: tab.filename }),
      title: t('LWC.desktop.close_unsaved.title'),
      type: 'warning',
    });
    if (response !== 0) return { cancelled: true };
  }

  if (!skipDeleteConfirm) {
    const deleteLabel = t('LWC.desktop.explorer.delete');
    const cancelLabel = t('LWC.commons.cancel');
    const messageKey =
      affectedTabs.length > 0
        ? target.isDirectory
          ? 'delete_confirm_folder_open'
          : 'delete_confirm_file_open'
        : target.isDirectory
          ? 'delete_confirm_folder'
          : 'delete_confirm_file';

    const { response } = await window.electronAPI.showNativeMessageBox({
      buttons: [deleteLabel, cancelLabel],
      cancelId: 1,
      defaultId: 0,
      message: t(`LWC.desktop.explorer.${messageKey}`, { name: target.name }),
      title: t('LWC.desktop.explorer.delete_title'),
      type: 'warning',
    });

    if (response !== 0) return { cancelled: true };
  }

  const result = await deleteExplorerItem(target.path);
  if (!result.success) return { cancelled: false, error: result.error };
  return { cancelled: false };
};
