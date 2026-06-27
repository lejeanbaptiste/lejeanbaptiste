import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useCallback, useEffect, useState } from 'react';

export const useCommonsUiBridge = () => {
  const { skipCopyPasteHelp, skipExplorerDeleteConfirm } = useAppState().ui;
  const { setSkipCopyPasteHelp, setSkipExplorerDeleteConfirm } = useActions().ui;
  const [encoderName, setEncoderNameState] = useState('');

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.getEncoderName) return;

    void window.electronAPI.getEncoderName().then((name) => {
      setEncoderNameState(name ?? '');
    });
  }, []);

  const setEncoderName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    setEncoderNameState(trimmed);
    await window.electronAPI?.setEncoderName?.(trimmed);
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;

    window.__ljbCommonsUi = {
      encoderName,
      skipCopyPasteHelp,
      skipExplorerDeleteConfirm,
      setEncoderName,
      setSkipCopyPasteHelp,
      setSkipExplorerDeleteConfirm,
    };

    return () => {
      delete window.__ljbCommonsUi;
    };
  }, [
    encoderName,
    setEncoderName,
    setSkipCopyPasteHelp,
    setSkipExplorerDeleteConfirm,
    skipCopyPasteHelp,
    skipExplorerDeleteConfirm,
  ]);
};
