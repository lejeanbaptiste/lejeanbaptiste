import { openFindPanel } from '@src/desktop/desktopLeftPanelBridge';
import { redoDocumentEditor, undoDocumentEditor } from '@src/desktop/editorUndoRedo';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';

/** App-wide Electron menu shortcuts (registered once, survives route changes). */
export const useDesktopAppMenuBridge = () => {
  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.onAppMenuAction) return;

    return window.electronAPI.onAppMenuAction((action) => {
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
      }
    });
  }, []);
};
