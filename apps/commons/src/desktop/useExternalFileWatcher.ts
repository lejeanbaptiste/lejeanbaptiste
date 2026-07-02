import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { recoverTranslationLinksOnExternalChange } from './translationRecovery';

export const useExternalFileWatcher = () => {
  const { activeTabPath, openTabs } = useAppState().project;
  const { contentHasChanged } = useAppState().editor;
  const { reloadTabFromDisk, setExternalChangePending, isTabContentStaleOnDisk } =
    useActions().project;
  const { notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation();

  const openTabsRef = useRef(openTabs);
  const activeTabPathRef = useRef(activeTabPath);
  const contentHasChangedRef = useRef(contentHasChanged);
  const promptingRef = useRef(new Set<string>());
  const previousActiveTabRef = useRef<string | null>(null);

  openTabsRef.current = openTabs;
  activeTabPathRef.current = activeTabPath;
  contentHasChangedRef.current = contentHasChanged;

  const promptReload = useCallback(
    async (filePath: string) => {
      if (!window.electronAPI?.showNativeMessageBox || promptingRef.current.has(filePath)) {
        return;
      }

      const tab = openTabsRef.current.find((item) => item.filePath === filePath);
      if (!tab) return;

      const isActive = activeTabPathRef.current === filePath;
      const isDirty = isActive ? contentHasChangedRef.current : tab.dirty;

      promptingRef.current.add(filePath);

      try {
        const message = isDirty
          ? t('LWC.desktop.external_file_changed.message_with_unsaved', {
              filename: tab.filename,
            })
          : t('LWC.desktop.external_file_changed.message', { filename: tab.filename });

        const { response } = await window.electronAPI.showNativeMessageBox({
          type: 'question',
          title: t('LWC.desktop.external_file_changed.title'),
          message,
          buttons: [
            t('LWC.desktop.external_file_changed.reload'),
            t('LWC.desktop.external_file_changed.keep_editing'),
          ],
        });

        if (response === 0) {
          await reloadTabFromDisk(filePath);
        } else {
          setExternalChangePending({ filePath, pending: false });
        }
      } finally {
        promptingRef.current.delete(filePath);
      }
    },
    [reloadTabFromDisk, setExternalChangePending, t],
  );

  const handleExternalChange = useCallback(
    async (filePath: string) => {
      const tab = openTabsRef.current.find((item) => item.filePath === filePath);
      if (!tab) return;

      // Tier-1 translation-link recovery: if the external edit stripped/scrambled
      // alignment-unit ids, restore them from the snapshot before the stale check, so the
      // reload prompt (and any reload) already sees the repaired file.
      try {
        const restored = await recoverTranslationLinksOnExternalChange(filePath);
        if (restored > 0) {
          notifyViaSnackbar(
            t('LWC.desktop.translation_links_restored', { count: restored }) as string,
          );
        }
      } catch (error) {
        console.error('[translation-recovery] failed', error);
      }

      const stale = await isTabContentStaleOnDisk(filePath);
      if (!stale) return;

      if (activeTabPathRef.current === filePath) {
        await promptReload(filePath);
        return;
      }

      setExternalChangePending({ filePath, pending: true });
    },
    [isTabContentStaleOnDisk, notifyViaSnackbar, promptReload, setExternalChangePending, t],
  );

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.syncWatchedFiles) return;

    void window.electronAPI.syncWatchedFiles(openTabs.map((tab) => tab.filePath));
  }, [openTabs]);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.onExternalFileChange) return;

    return window.electronAPI.onExternalFileChange((filePath) => {
      void handleExternalChange(filePath);
    });
  }, [handleExternalChange]);

  useEffect(() => {
    if (!activeTabPath) {
      previousActiveTabRef.current = null;
      return;
    }

    if (previousActiveTabRef.current === activeTabPath) return;

    previousActiveTabRef.current = activeTabPath;

    const tab = openTabs.find((item) => item.filePath === activeTabPath);
    if (tab?.externalChangePending) {
      void promptReload(activeTabPath);
    }
  }, [activeTabPath, openTabs, promptReload]);
};
