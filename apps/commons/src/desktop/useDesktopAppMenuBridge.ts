import { openFindPanel } from '@src/desktop/desktopLeftPanelBridge';
import { redoDocumentEditor, undoDocumentEditor } from '@src/desktop/editorUndoRedo';
import { useActions } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';

const LEAF_WRITER_DOCS_URL =
  'https://www.leaf-vre.org/docs/documentation/leaf-writer-documentation';

/**
 * Cmd/Ctrl +/-/0 zooms whatever text context is active: the translation pane
 * when it has focus, the source (Monaco) view when it's mounted (source mode
 * or the edit-source dialog), otherwise the visual editor.
 */
const activeZoomBridge = () => {
  if (window.__leafWriterTranslationPane?.isActive() && window.__leafWriterTranslationZoom) {
    return window.__leafWriterTranslationZoom;
  }
  return window.__leafWriterSourceZoom ?? window.__leafWriterEditorZoom;
};

/** App-wide Electron menu shortcuts (registered once, survives route changes). */
export const useDesktopAppMenuBridge = () => {
  const { closeProject, openProject } = useActions().project;

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.onAppMenuAction) return;

    // Re-apply the persisted interface zoom (set via the settings slider,
    // stored by cwrc-leafwriter's uiZoom module under the same key).
    const storedUiZoom = Number(window.localStorage.getItem('leafWriterUiZoom'));
    if (Number.isFinite(storedUiZoom) && storedUiZoom > 0 && storedUiZoom !== 100) {
      window.electronAPI.setUiZoomFactor?.(storedUiZoom / 100);
    }

    const unsubscribe = window.electronAPI.onAppMenuAction((action) => {
      if (action === 'open-project') {
        void openProject();
        return;
      }

      if (action === 'close-project') {
        void closeProject();
        return;
      }

      if (action === 'open-find') {
        openFindPanel();
        return;
      }

      if (action === 'undo') {
        void undoDocumentEditor();
        return;
      }

      if (action === 'redo') {
        void redoDocumentEditor();
        return;
      }

      if (action === 'editor-zoom-in') {
        activeZoomBridge()?.zoomIn();
        return;
      }

      if (action === 'editor-zoom-out') {
        activeZoomBridge()?.zoomOut();
        return;
      }

      if (action === 'editor-zoom-reset') {
        activeZoomBridge()?.reset();
        return;
      }

      if (action === 'open-documentation') {
        window.open(LEAF_WRITER_DOCS_URL, '_blank', 'noopener,noreferrer');
      }
    });

    void window.electronAPI.signalRendererReady?.();

    return unsubscribe;
  }, [closeProject, openProject]);
};
