import { clearFindHighlights } from '@src/desktop/find/findEditorHighlights';
import { openFindPanel } from '@src/desktop/desktopLeftPanelBridge';
import { openEditionMetadataDialog } from '@src/desktop/projectOnboarding';
import { checkSchemaUpdateManually } from '@src/desktop/schemaUpdateCheck';
import { leafwriterAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { mergeEditorBodyWithStoredHeader, stripTeiHeaderForVisualEditor } from './teiHeaderXml';

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
  fallbackXml?: string,
) => {
  const content = leafWriter ? await leafWriter.getContent() : await window.writer?.getContent();
  if (!content || !isDesktop()) return content;
  if (window.writer?.overmindState?.ui?.editorViewMode === 'source') return content;

  const baseXml =
    window.__desktopStoredDocumentXml ??
    fallbackXml ??
    window.writer?.overmindState?.document?.xml ??
    content;
  return mergeEditorBodyWithStoredHeader(stripTeiHeaderForVisualEditor(content), baseXml);
};

export const useProjectMenu = () => {
  const {
    closeTab,
    markTabDirty,
    newFile,
    openProject,
    promptCloseDirtyTab,
    refreshProjectSchemaConfig,
    saveActiveTab,
    saveActiveTabAs,
  } = useActions().project;
  const { setContentHasChanged } = useActions().editor;
  const { closeForegroundPopup: closeCommonsPopup, notifyViaSnackbar } = useActions().ui;
  const { activeTabPath, isProjectReady, openTabs, projectFilePath } = useAppState().project;
  const { contentHasChanged } = useAppState().editor;
  const [leafWriter] = useAtom(leafwriterAtom);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [timeMachineOpen, setTimeMachineOpen] = useState(false);

  const finalizeSavedDocument = useCallback(
    (content: string) => {
      setContentHasChanged(false);
      markTabDirty(false);
      leafWriter?.setContentHasChanged(false);
      window.__desktopStoredDocumentXml = content;
      window.writer?.overmindActions?.document?.setDocumentXml(content);
      window.writer?.overmindActions?.ui?.markSourceSaved?.(content);
      void window.writer?.overmindActions?.validator?.validate();
    },
    [leafWriter, markTabDirty, setContentHasChanged],
  );

  const saveCurrentDocument = useCallback(async () => {
    if (!isDesktop()) return;

    clearFindHighlights();
    const activeTab = openTabs.find((tab) => tab.filePath === activeTabPath);
    const content = await getEditorContent(leafWriter, activeTab?.content);
    if (!content) {
      notifyViaSnackbar('Open an XML file before saving.');
      return;
    }

    const result = await saveActiveTab({ content });
    if (result.success) {
      finalizeSavedDocument(result.content ?? content);
      notifyViaSnackbar({ message: 'Document saved.', options: { variant: 'success' } });
      return;
    }

    if (result.error) {
      notifyViaSnackbar({ message: result.error, options: { variant: 'error' } });
    }
  }, [
    activeTabPath,
    finalizeSavedDocument,
    leafWriter,
    notifyViaSnackbar,
    openTabs,
    saveActiveTab,
  ]);

  const saveCurrentDocumentAs = useCallback(async () => {
    if (!isDesktop()) return;

    clearFindHighlights();
    const activeTab = openTabs.find((tab) => tab.filePath === activeTabPath);
    const content = await getEditorContent(leafWriter, activeTab?.content);
    if (!content) {
      notifyViaSnackbar('Open an XML file before saving.');
      return;
    }

    const result = await saveActiveTabAs({ content });
    if (result.cancelled) return;

    if (result.success) {
      finalizeSavedDocument(result.content ?? content);
      notifyViaSnackbar({ message: 'Document saved.', options: { variant: 'success' } });
      return;
    }

    if (result.error) {
      notifyViaSnackbar({ message: result.error, options: { variant: 'error' } });
    }
  }, [
    activeTabPath,
    finalizeSavedDocument,
    leafWriter,
    notifyViaSnackbar,
    openTabs,
    saveActiveTabAs,
  ]);

  const closeCurrentTab = useCallback(async () => {
    if (!activeTabPath) {
      console.info('[cursor-session] close current tab skipped: no active tab');
      return;
    }

    clearFindHighlights();
    const tab = openTabs.find((item) => item.filePath === activeTabPath);
    if (!tab) {
      console.info('[cursor-session] close current tab skipped: active tab missing', {
        activeTabPath,
      });
      return;
    }

    console.info('[cursor-session] close current tab before content read', {
      activeTabPath,
      bridgeCapture: window.__leafWriterCursorSession?.capture?.() ?? null,
      contentHasChanged,
      tabDirty: tab.dirty,
    });
    const content = await getEditorContent(leafWriter, tab.content);
    const isDirty = contentHasChanged || tab.dirty;
    console.info('[cursor-session] close current tab after content read', {
      activeTabPath,
      bridgeCapture: window.__leafWriterCursorSession?.capture?.() ?? null,
      contentLength: content?.length ?? null,
      isDirty,
    });

    if (isDirty) {
      const result = await promptCloseDirtyTab({
        tab: {
          content: tab.content,
          filePath: tab.filePath,
          filename: tab.filename,
          isTemp: tab.isTemp,
        },
        contentOverride: content ?? tab.content,
      });
      if (result === 'abort' || result === 'handled') return;
    }

    await closeTab({ content, filePath: activeTabPath });
  }, [activeTabPath, closeTab, contentHasChanged, leafWriter, openTabs, promptCloseDirtyTab]);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.onAppMenuAction) return;

    return window.electronAPI.onAppMenuAction((action) => {
      if (action === 'open-project') {
        void openProject();
        return;
      }

      if (action === 'new-file') {
        void newFile();
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

      if (action === 'close-tab') {
        void closeCurrentTab();
        return;
      }

      if (action === 'open-about') {
        setAboutOpen(true);
        return;
      }

      if (action === 'open-time-machine') {
        if (!isProjectReady || !projectFilePath) {
          notifyViaSnackbar('Open a project first.');
          return;
        }

        setTimeMachineOpen(true);
        return;
      }

      if (action === 'open-settings') {
        void openSettings(leafWriter, (message) => notifyViaSnackbar(message));
        return;
      }

      if (action === 'edition-metadata') {
        if (!isProjectReady || !projectFilePath) {
          notifyViaSnackbar('Open a project first.');
          return;
        }

        void openEditionMetadataDialog(projectFilePath);
        return;
      }

      if (action === 'zotero-preferences') {
        if (!isProjectReady || !projectFilePath) {
          notifyViaSnackbar('Open a project first.');
          return;
        }

        if (!(window as Window & { __desktopCitationBridge?: unknown }).__desktopCitationBridge) {
          notifyViaSnackbar('Open the Translation tab to choose Zotero citation style.');
          return;
        }

        window.dispatchEvent(new CustomEvent('desktop:zotero-open-style-picker'));
        return;
      }

      if (action === 'zotero-refresh') {
        window.dispatchEvent(new CustomEvent('desktop:zotero-refresh-citations'));
        notifyViaSnackbar('Refreshing Zotero citations.');
        return;
      }

      if (action === 'check-schema-update') {
        if (!isProjectReady || !projectFilePath) {
          notifyViaSnackbar('Open a project first.');
          return;
        }

        void checkSchemaUpdateManually(projectFilePath, {
          notify: (message) => notifyViaSnackbar(message),
          onBundleUpdated: (bundle) => refreshProjectSchemaConfig(bundle),
        });
      }
    });
  }, [
    isProjectReady,
    leafWriter,
    newFile,
    notifyViaSnackbar,
    openProject,
    projectFilePath,
    closeCurrentTab,
    refreshProjectSchemaConfig,
    saveCurrentDocument,
    saveCurrentDocumentAs,
  ]);

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

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        event.stopPropagation();
        openFindPanel();
        return;
      }

      if (event.metaKey && event.key === ',') {
        event.preventDefault();
        event.stopPropagation();
        await openSettings(leafWriter, (message) => notifyViaSnackbar(message));
        return;
      }

      // File menu shortcuts (Save, Save As, Open Project, New File) are handled by the
      // Electron application menu accelerators via onAppMenuAction. Handling them here too
      // caused duplicate actions (e.g. Cmd+O firing openProject twice, Cmd+S racing saves).
    },
    [closeCommonsPopup, leafWriter, notifyViaSnackbar],
  );

  return { aboutOpen, onKeydownHandle, setAboutOpen, setTimeMachineOpen, timeMachineOpen };
};
