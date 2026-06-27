import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';

export const useCommonsUiBridge = () => {
  const { skipCopyPasteHelp, skipExplorerDeleteConfirm } = useAppState().ui;
  const { setSkipCopyPasteHelp, setSkipExplorerDeleteConfirm } = useActions().ui;

  useEffect(() => {
    if (!isDesktop()) return;

    window.__ljbCommonsUi = {
      skipCopyPasteHelp,
      skipExplorerDeleteConfirm,
      setSkipCopyPasteHelp,
      setSkipExplorerDeleteConfirm,
    };

    return () => {
      delete window.__ljbCommonsUi;
    };
  }, [
    setSkipCopyPasteHelp,
    setSkipExplorerDeleteConfirm,
    skipCopyPasteHelp,
    skipExplorerDeleteConfirm,
  ]);
};
