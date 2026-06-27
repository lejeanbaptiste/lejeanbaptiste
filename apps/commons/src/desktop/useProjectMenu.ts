import { clearFindHighlights } from '@src/desktop/find/findEditorHighlights';
import { openFindPanel } from '@src/desktop/desktopLeftPanelBridge';
import { leafwriterAtom } from '@src/jotai';
import { openNativeSettings } from '@src/desktop/openNativeSettings';
import { useActions } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

const openSettings = async (leafWriter: { showSettingsDialog: () => Promise<void> } | null) => {
  if (await openNativeSettings()) return;

  if (leafWriter) {
    await leafWriter.showSettingsDialog();
    return;
  }

  if (window.writer) {
    window.writer.overmindActions.ui.openDialog({ type: 'settings' });
  }
};

export const useProjectMenu = () => {
  const { openProject, saveActiveTab } = useActions().project;
  const { closeForegroundPopup: closeCommonsPopup, notifyViaSnackbar } = useActions().ui;
  const [leafWriter] = useAtom(leafwriterAtom);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.onAppMenuAction) return;

    return window.electronAPI.onAppMenuAction((action) => {
      if (action === 'open-project') {
        void openProject();
        return;
      }

      if (action === 'open-about') {
        setAboutOpen(true);
        return;
      }

      if (action === 'open-settings') {
        void (async () => {
          if (leafWriter || window.writer) {
            await openSettings(leafWriter);
          } else {
            notifyViaSnackbar('Open an XML file to access editor settings.');
          }
        })();
      }
    });
  }, [leafWriter, notifyViaSnackbar, openProject]);

  const onKeydownHandle = useCallback(
    async (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        let closed = false;
        if (leafWriter) {
          closed = leafWriter.closeForegroundPopup();
        } else if (window.writer) {
          closed = window.writer.overmindActions.ui.closeForegroundPopup();
        }
        if (!closed) {
          closed = closeCommonsPopup();
        }

        if (closed) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.code === 'KeyF') {
        event.preventDefault();
        event.stopPropagation();
        openFindPanel();
        return;
      }

      if (event.metaKey && event.code === 'Comma') {
        event.preventDefault();
        event.stopPropagation();
        if (leafWriter || window.writer) {
          await openSettings(leafWriter);
        } else {
          notifyViaSnackbar('Open an XML file to access editor settings.');
        }
        return;
      }

      if (!event.metaKey) return;

      if (event.code === 'KeyS') {
        event.preventDefault();
        event.stopPropagation();
        if (!leafWriter) return;
        clearFindHighlights();
        const content = await leafWriter.getContent();
        await saveActiveTab({ content });
        return;
      }

      if (event.code === 'KeyO') {
        event.preventDefault();
        event.stopPropagation();
        await openProject();
      }
    },
    [closeCommonsPopup, leafWriter, notifyViaSnackbar, openProject, saveActiveTab],
  );

  return { aboutOpen, onKeydownHandle, setAboutOpen };
};
