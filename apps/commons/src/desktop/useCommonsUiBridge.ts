import { useActions, useAppState } from '@src/overmind';
import { registerLeafWriterCommonsI18n } from '@src/desktop/registerLeafWriterCommonsI18n';
import { isDesktop, type AiApiSettings } from '@src/types/desktop';
import { useCallback, useEffect, useState } from 'react';

export const useCommonsUiBridge = () => {
  const { skipCopyPasteHelp, skipExplorerDeleteConfirm, themeAppearance, currentLocale } =
    useAppState().ui;
  const { setSkipCopyPasteHelp, setSkipExplorerDeleteConfirm, setThemeAppearance, switchLanguage } =
    useActions().ui;
  const [encoderName, setEncoderNameState] = useState('');
  const [aiApiSettings, setAiApiSettingsState] = useState<AiApiSettings | null>(null);
  const [entityDbFolder, setEntityDbFolderState] = useState<string | null>(null);
  const [rememberWorkspaceOnStartup, setRememberWorkspaceOnStartupState] = useState(true);

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

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.getEntityDbFolder) return;

    void window.electronAPI.getEntityDbFolder().then((folder) => {
      setEntityDbFolderState(typeof folder === 'string' && folder.trim() ? folder : null);
    });
  }, []);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.getRememberWorkspaceOnStartup) return;

    void window.electronAPI.getRememberWorkspaceOnStartup().then((remember) => {
      if (typeof remember === 'boolean') setRememberWorkspaceOnStartupState(remember);
    });
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;

    const syncThemeFromStorage = () => {
      const stored = localStorage.getItem('themeAppearance');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        if (stored !== themeAppearance) setThemeAppearance(stored);
      }
    };

    const syncLanguageFromStorage = () => {
      const stored = localStorage.getItem('i18nextLng');
      if (stored && stored !== currentLocale) switchLanguage(stored as typeof currentLocale);
    };

    window.addEventListener('changeTheme', syncThemeFromStorage);
    window.addEventListener('changeLanguage', syncLanguageFromStorage);
    return () => {
      window.removeEventListener('changeTheme', syncThemeFromStorage);
      window.removeEventListener('changeLanguage', syncLanguageFromStorage);
    };
  }, [currentLocale, setThemeAppearance, switchLanguage, themeAppearance]);

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

  const pickEntityDbFolder = useCallback(async () => {
    const picked = await window.electronAPI?.pickEntityDbFolder?.();
    if (picked) {
      await window.electronAPI?.setEntityDbFolder?.(picked);
      setEntityDbFolderState(picked);
    }
  }, []);

  const setRememberWorkspaceOnStartup = useCallback(async (value: boolean) => {
    setRememberWorkspaceOnStartupState(value);
    await window.electronAPI?.setRememberWorkspaceOnStartup?.(value);
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;
    registerLeafWriterCommonsI18n();

    window.__ljbCommonsUi = {
      encoderName,
      aiApiSettings,
      entityDbFolder,
      rememberWorkspaceOnStartup,
      skipCopyPasteHelp,
      skipExplorerDeleteConfirm,
      setAiApiSettings,
      setEncoderName,
      setRememberWorkspaceOnStartup,
      setSkipCopyPasteHelp,
      setSkipExplorerDeleteConfirm,
      pickEntityDbFolder,
      testAiConnection,
    };

    return () => {
      delete window.__ljbCommonsUi;
    };
  }, [
    aiApiSettings,
    encoderName,
    entityDbFolder,
    rememberWorkspaceOnStartup,
    pickEntityDbFolder,
    setAiApiSettings,
    setEncoderName,
    setRememberWorkspaceOnStartup,
    setSkipCopyPasteHelp,
    setSkipExplorerDeleteConfirm,
    skipCopyPasteHelp,
    skipExplorerDeleteConfirm,
    testAiConnection,
  ]);
};
