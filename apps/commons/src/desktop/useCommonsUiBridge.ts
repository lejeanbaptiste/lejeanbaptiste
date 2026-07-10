import { useActions, useAppState } from '@src/overmind';
import { registerLeafWriterCommonsI18n } from '@src/desktop/registerLeafWriterCommonsI18n';
import { isDesktop, type AiApiSettings } from '@src/types/desktop';
import type {
  AuthorityLifecycleRunResult,
  AuthorityLifecycleSetEnabledOptions,
  AuthorityLifecycleStatus,
} from '@src/desktop/authorityLifecycleTypes';
import { useCallback, useEffect, useState } from 'react';
import { createEntitiesScaffold } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { AUTHORITY_PACKS_DIRNAME } from '@src/desktop/authorityPackTypes';

export const useCommonsUiBridge = () => {
  const {
    skipCopyPasteHelp,
    skipEntityDetachConfirm,
    skipExplorerDeleteConfirm,
    themeAppearance,
    currentLocale,
  } = useAppState().ui;
  const {
    setSkipCopyPasteHelp,
    setSkipEntityDetachConfirm,
    setSkipExplorerDeleteConfirm,
    setThemeAppearance,
    switchLanguage,
  } = useActions().ui;
  const [encoderName, setEncoderNameState] = useState('');
  const [aiApiSettings, setAiApiSettingsState] = useState<AiApiSettings | null>(null);
  const [entityDbFolder, setEntityDbFolderState] = useState<string | null>(null);
  const [rememberWorkspaceOnStartup, setRememberWorkspaceOnStartupState] = useState(true);
  const [authorityLifecycleStatus, setAuthorityLifecycleStatusState] =
    useState<AuthorityLifecycleStatus | null>(null);

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

  const refreshAuthorityLifecycle = useCallback(async () => {
    if (!window.electronAPI?.authorityLifecycleGet) return;
    const next = await window.electronAPI.authorityLifecycleGet();
    setAuthorityLifecycleStatusState(next);
  }, []);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.authorityLifecycleGet) return;
    void refreshAuthorityLifecycle();
  }, [entityDbFolder, refreshAuthorityLifecycle]);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.authorityLifecycleMaybeCheckUpdates) return;
    void window.electronAPI.authorityLifecycleMaybeCheckUpdates().then((status) => {
      if (status) setAuthorityLifecycleStatusState(status);
    });
  }, [entityDbFolder]);

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
          apiKey: '',
          baseUrl: 'http://localhost:1234/v1',
          customInstructions: '',
          model: '',
          temperature: 0.1,
          streamResults: false,
          verifiedAt: null,
          verifiedBaseUrl: '',
          verifiedModel: '',
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

  const pickEntityDbFolder = useCallback(async (): Promise<string | null> => {
    const picked = await window.electronAPI?.pickEntityDbFolder?.();
    if (!picked) return null;

    const folder = picked.replace(/[/\\]+$/, '');
    const entitiesHere = await window.electronAPI?.pathExists?.(`${folder}/entities.xml`);
    if (!entitiesHere) {
      const parent = folder.replace(/[/\\][^/\\]+$/, '');
      const entitiesInParent =
        parent.length > 0 && (await window.electronAPI?.pathExists?.(`${parent}/entities.xml`));
      if (entitiesInParent) {
        await window.electronAPI?.showNativeMessageBox?.({
          type: 'warning',
          title: 'No entities.xml in that folder',
          message: `Your entity database is probably the parent folder:\n${parent}\n\nChoose that folder, not the project subfolder inside it.`,
          buttons: ['OK'],
        });
        return null;
      }
      const choice = await window.electronAPI?.showNativeMessageBox?.({
        type: 'question',
        title: 'Create a new entity database?',
        message: `This folder has no entities.xml yet:\n${folder}\n\nLe Jean-Baptiste can set up a new entity database here from scratch. Compiled authority packs will go in authority-packs/ beside it.`,
        buttons: ['Create entity database', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice?.response !== 0) return null;
      await window.electronAPI?.writeFile?.(`${folder}/entities.xml`, createEntitiesScaffold());
      await window.electronAPI?.ensureDirectory?.(`${folder}/${AUTHORITY_PACKS_DIRNAME}`);
    }

    await window.electronAPI?.setEntityDbFolder?.(picked);
    setEntityDbFolderState(picked);
    return picked;
  }, []);

  const setRememberWorkspaceOnStartup = useCallback(async (value: boolean) => {
    setRememberWorkspaceOnStartupState(value);
    await window.electronAPI?.setRememberWorkspaceOnStartup?.(value);
  }, []);

  const setAuthorityLifecycleEnabled = useCallback(
    async (options: AuthorityLifecycleSetEnabledOptions): Promise<AuthorityLifecycleRunResult> => {
      const result = (await window.electronAPI?.authorityLifecycleSetEnabled?.(options)) ?? {
        ok: false,
        error: 'Authority lifecycle bridge is unavailable.',
      };
      await refreshAuthorityLifecycle();
      return result;
    },
    [refreshAuthorityLifecycle],
  );

  const runAuthorityLifecycleUpdate =
    useCallback(async (): Promise<AuthorityLifecycleRunResult> => {
      const result = (await window.electronAPI?.authorityLifecycleUpdate?.()) ?? {
        ok: false,
        error: 'Authority lifecycle bridge is unavailable.',
      };
      await refreshAuthorityLifecycle();
      return result;
    }, [refreshAuthorityLifecycle]);

  const revealAuthorityLifecycleFolder = useCallback(async () => {
    await window.electronAPI?.authorityLifecycleRevealFolder?.();
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
      skipEntityDetachConfirm,
      skipExplorerDeleteConfirm,
      authorityLifecycleStatus,
      setAiApiSettings,
      setEncoderName,
      setRememberWorkspaceOnStartup,
      setSkipCopyPasteHelp,
      setSkipEntityDetachConfirm,
      setSkipExplorerDeleteConfirm,
      pickEntityDbFolder,
      testAiConnection,
      refreshAuthorityLifecycle,
      setAuthorityLifecycleEnabled,
      runAuthorityLifecycleUpdate,
      revealAuthorityLifecycleFolder,
    };

    window.dispatchEvent(new Event('ljbCommonsUiChanged'));

    return () => {
      delete window.__ljbCommonsUi;
    };
  }, [
    aiApiSettings,
    authorityLifecycleStatus,
    encoderName,
    entityDbFolder,
    rememberWorkspaceOnStartup,
    pickEntityDbFolder,
    refreshAuthorityLifecycle,
    runAuthorityLifecycleUpdate,
    revealAuthorityLifecycleFolder,
    setAiApiSettings,
    setAuthorityLifecycleEnabled,
    setEncoderName,
    setRememberWorkspaceOnStartup,
    setSkipCopyPasteHelp,
    setSkipEntityDetachConfirm,
    setSkipExplorerDeleteConfirm,
    skipCopyPasteHelp,
    skipEntityDetachConfirm,
    skipExplorerDeleteConfirm,
    testAiConnection,
  ]);
};
