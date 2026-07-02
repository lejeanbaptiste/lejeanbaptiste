import { useActions, useAppState } from '@src/overmind';
import { isDesktop, type AiApiSettings } from '@src/types/desktop';
import { useCallback, useEffect, useState } from 'react';

export const useCommonsUiBridge = () => {
  const { skipCopyPasteHelp, skipExplorerDeleteConfirm } = useAppState().ui;
  const { setSkipCopyPasteHelp, setSkipExplorerDeleteConfirm } = useActions().ui;
  const [encoderName, setEncoderNameState] = useState('');
  const [aiApiSettings, setAiApiSettingsState] = useState<AiApiSettings | null>(null);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.getEncoderName) return;

    void window.electronAPI.getEncoderName().then((name) => {
      setEncoderNameState(name ?? '');
    });
  }, []);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.getAiApiSettings) return;

    void window.electronAPI.getAiApiSettings().then((settings) => {
      setAiApiSettingsState(settings);
    });
  }, []);

  const setEncoderName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    setEncoderNameState(trimmed);
    await window.electronAPI?.setEncoderName?.(trimmed);
  }, []);

  const setAiApiSettings = useCallback(
    async (settings: Partial<AiApiSettings>) => {
      const next = {
        ...(aiApiSettings ?? {
          apiKey: 'lm-studio',
          baseUrl: 'http://localhost:1234/v1',
          customInstructions: '',
          model: '',
          temperature: 0.1,
        }),
        ...settings,
      };
      setAiApiSettingsState(next);
      await window.electronAPI?.setAiApiSettings?.(next);
    },
    [aiApiSettings],
  );

  const testAiConnection = useCallback(async (settings: Partial<AiApiSettings>) => {
    return (
      (await window.electronAPI?.testAiConnection?.(settings)) ?? {
        ok: false,
        error: 'Desktop AI API bridge is unavailable.',
      }
    );
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;

    window.__ljbCommonsUi = {
      encoderName,
      aiApiSettings,
      skipCopyPasteHelp,
      skipExplorerDeleteConfirm,
      setAiApiSettings,
      setEncoderName,
      setSkipCopyPasteHelp,
      setSkipExplorerDeleteConfirm,
      testAiConnection,
    };

    return () => {
      delete window.__ljbCommonsUi;
    };
  }, [
    encoderName,
    aiApiSettings,
    setAiApiSettings,
    setEncoderName,
    setSkipCopyPasteHelp,
    setSkipExplorerDeleteConfirm,
    skipCopyPasteHelp,
    skipExplorerDeleteConfirm,
    testAiConnection,
  ]);
};
