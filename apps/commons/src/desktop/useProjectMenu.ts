import { clearFindHighlights } from '@src/desktop/find/findEditorHighlights';
import { openFindPanel } from '@src/desktop/desktopLeftPanelBridge';
import { leafwriterAtom } from '@src/jotai';
import { useActions } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

const openSettings = async (
  leafWriter: { showSettingsDialog: () => Promise<void> } | null,
  notify: (message: string) => void,
) => {
  if (leafWriter) {
    await leafWriter.showSettingsDialog();
    return;
  }

  if (window.writer) {
    window.writer.overmindActions.ui.openDialog({ type: 'settings' });
    return;
  }

  notify('Open an XML file to change settings.');
};

const getEditorContent = async (
  leafWriter: { getContent: () => Promise<string | undefined> } | null,
) => {
  if (leafWriter) return leafWriter.getContent();
  return window.writer?.getContent();
};

export const useProjectMenu = () => {
  const { openProject, saveActiveTab, saveActiveTabAs, markTabDirty } = useActions().project;
  const { setContentHasChanged } = useActions().editor;
  const { closeForegroundPopup: closeCommonsPopup, notifyViaSnackbar } = useActions().ui;
  const [leafWriter] = useAtom(leafwriterAtom);
  const [aboutOpen, setAboutOpen] = useState(false);

  const finalizeSavedDocument = useCallback(
    (content: string) => {
      setContentHasChanged(false);
      markTabDirty(false);
      leafWriter?.setContentHasChanged(false);
      window.writer?.overmindActions?.document?.setDocumentXml(content);
      window.writer?.overmindActions?.ui?.markSourceSaved?.(content);
    },
    [leafWriter, markTabDirty, setContentHasChanged],
  );

  const saveCurrentDocument = useCallback(async () => {
    if (!isDesktop()) return;

    clearFindHighlights();
    const content = await getEditorContent(leafWriter);
    if (!content) {
      notifyViaSnackbar('Open an XML file before saving.');
      return;
    }

    const result = await saveActiveTab({ content });
    if (result.success) {
      finalizeSavedDocument(content);
      notifyViaSnackbar({ message: 'Document saved.', options: { variant: 'success' } });
      return;
    }

    if (result.error) {
      notifyViaSnackbar({ message: result.error, options: { variant: 'error' } });
    }
  }, [finalizeSavedDocument, leafWriter, notifyViaSnackbar, saveActiveTab]);

  const saveCurrentDocumentAs = useCallback(async () => {
    if (!isDesktop()) return;

    clearFindHighlights();
    const content = await getEditorContent(leafWriter);
    if (!content) {
      notifyViaSnackbar('Open an XML file before saving.');
      return;
    }

    const result = await saveActiveTabAs({ content });
    if (result.cancelled) return;

    if (result.success) {
      finalizeSavedDocument(content);
      notifyViaSnackbar({ message: 'Document saved.', options: { variant: 'success' } });
      return;
    }

    if (result.error) {
      notifyViaSnackbar({ message: result.error, options: { variant: 'error' } });
    }
  }, [finalizeSavedDocument, leafWriter, notifyViaSnackbar, saveActiveTabAs]);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.onAppMenuAction) return;

    return window.electronAPI.onAppMenuAction((action) => {
      if (action === 'open-project') {
        void openProject();
        return;
      }

      if (action === 'save') {
        void saveCurrentDocument();
        return;
      }

      if (action === 'save-as') {
        void saveCurrentDocumentAs();
        return;
      }

      if (action === 'open-about') {
        setAboutOpen(true);
        return;
      }

      if (action === 'open-settings') {
        void openSettings(leafWriter, (message) => notifyViaSnackbar(message));
        return;
      }
    });
  }, [leafWriter, notifyViaSnackbar, openProject, saveCurrentDocument, saveCurrentDocumentAs]);

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
        await openSettings(leafWriter, (message) => notifyViaSnackbar(message));
        return;
      }

      if (!(event.metaKey || event.ctrlKey)) return;

      if (event.code === 'KeyS') {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          await saveCurrentDocumentAs();
        } else {
          await saveCurrentDocument();
        }
        return;
      }

      if (event.code === 'KeyO') {
        event.preventDefault();
        event.stopPropagation();
        await openProject();
      }
    },
    [
      closeCommonsPopup,
      leafWriter,
      notifyViaSnackbar,
      openProject,
      saveCurrentDocument,
      saveCurrentDocumentAs,
    ],
  );

  return { aboutOpen, onKeydownHandle, setAboutOpen };
};
