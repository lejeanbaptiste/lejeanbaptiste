import { openFindPanel } from '@src/desktop/desktopLeftPanelBridge';
import { redoDocumentEditor, undoDocumentEditor } from '@src/desktop/editorUndoRedo';
import { useActions } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';

const LEAF_WRITER_DOCS_URL =
  'https://www.leaf-vre.org/docs/documentation/leaf-writer-documentation';

/** App-wide Electron menu shortcuts (registered once, survives route changes). */
export const useDesktopAppMenuBridge = () => {
  const { openProject } = useActions().project;

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.onAppMenuAction) return;

    const unsubscribe = window.electronAPI.onAppMenuAction((action) => {
      if (action === 'open-project') {
        void openProject();
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

      if (action === 'open-documentation') {
        window.open(LEAF_WRITER_DOCS_URL, '_blank', 'noopener,noreferrer');
      }
    });

    void window.electronAPI.signalRendererReady?.();

    return unsubscribe;
  }, [openProject]);
};
