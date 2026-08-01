import { useActions, useAppState } from '@src/overmind';
import { registerLeafWriterCommonsI18n } from '@src/desktop/registerLeafWriterCommonsI18n';
import { isDesktop, type AiApiSettings } from '@src/types/desktop';
import { clearAchievementsCache } from '@src/desktop/achievements/store';
import type {
  AuthorityLifecycleRunResult,
  AuthorityLifecycleSetEnabledOptions,
  AuthorityLifecycleStatus,
} from '@src/desktop/authorityLifecycleTypes';
import { useCallback, useEffect, useState } from 'react';
import { createEntitiesScaffold } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { refreshCbdbConcordanceAfterPackLifecycle } from '../../../../packages/cwrc-leafwriter/src/autoTagging/cbdbConcordance';
import { clearPackContentCache } from '../../../../packages/cwrc-leafwriter/src/services/authority-pack-lookup';
import { AUTHORITY_PACKS_DIRNAME } from '@src/desktop/authorityPackTypes';
import { PROJECT_FILE_NAME } from '@src/desktop/projectFile';

const afterAuthorityPackLifecycleSuccess = async (): Promise<void> => {
  clearPackContentCache();
  // PEDB only — matches Database panel reload. Failures are non-fatal; reload is the safety net.
  try {
    await refreshCbdbConcordanceAfterPackLifecycle();
  } catch {
    // Pack install already succeeded; concordance can wait for panel reload.
  }
};

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
    openDialog,
  } = useActions().ui;
  const [encoderName, setEncoderNameState] = useState('');
  const [encoderNameLoaded, setEncoderNameLoaded] = useState(false);
  const [aiApiSettings, setAiApiSettingsState] = useState<AiApiSettings | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [entityDbFolder, setEntityDbFolderState] = useState<string | null>(null);
  const [rememberWorkspaceOnStartup, setRememberWorkspaceOnStartupState] = useState(true);
  const [authorityLifecycleStatus, setAuthorityLifecycleStatusState] =
    useState<AuthorityLifecycleStatus | null>(null);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.getEncoderName) return;

    void window.electronAPI.getEncoderName().then((name) => {
      setEncoderNameState(name ?? '');
      setEncoderNameLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.getAiApiSettings) return;

    void window.electronAPI.getAiApiSettings().then((settings) => {
      setAiApiSettingsState(settings);
    });
  }, []);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.getCachedLeaderboardToken) return;

    void window.electronAPI.getCachedLeaderboardToken().then((token) => {
      setGithubConnected(Boolean(token));
    });
  }, []);

  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.getEntityDbFolder) return;

    void window.electronAPI
      .getEntityDbFolder()
      .then((folder) => {
        setEntityDbFolderState(typeof folder === 'string' && folder.trim() ? folder : null);
      })
      .catch((error) => {
        console.error('Failed to load entity database folder:', error);
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

  const connectGithub = useCallback(async (onStarted?: (userCode: string) => void) => {
    const api = window.electronAPI;
    if (!api?.startLeaderboardDeviceFlow || !api.pollLeaderboardDeviceFlow) {
      return { ok: false, error: 'Desktop GitHub bridge is unavailable.' };
    }

    try {
      const flow = await api.startLeaderboardDeviceFlow();
      onStarted?.(flow.userCode);
      const result = await api.pollLeaderboardDeviceFlow(
        flow.deviceCode,
        flow.interval,
        flow.expiresIn,
      );
      if ('token' in result) {
        setGithubConnected(true);
        return { ok: true };
      }
      return { ok: false, error: result.error };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not connect to GitHub.',
      };
    }
  }, []);

  const disconnectGithub = useCallback(async () => {
    await window.electronAPI?.clearCachedLeaderboardToken?.();
    setGithubConnected(false);
  }, []);

  const confirmCreateEntityDb = useCallback(
    (folder: string): Promise<boolean> =>
      new Promise((resolve) => {
        openDialog({
          type: 'simple',
          props: {
            title: 'Create a new entity database?',
            Body: `This folder has no entities.xml yet:\n${folder}\n\nLe Jean-Baptiste can set up a new entity database here from scratch. Compiled authority packs will go in authority-packs/ beside it.`,
            actions: [
              { action: 'cancel', label: 'Cancel' },
              { action: 'create', label: 'Create entity database', variant: 'contained' },
            ],
            preventEscape: true,
            onClose: (action) => resolve(action === 'create'),
          },
        });
      }),
    [openDialog],
  );

  const pickEntityDbFolder = useCallback(async (): Promise<string | null> => {
    const picked = await window.electronAPI?.pickEntityDbFolder?.();
    if (!picked) return null;

    const folder = picked.replace(/[/\\]+$/, '');

    const isProjectFolder = await window.electronAPI?.pathExists?.(
      `${folder}/${PROJECT_FILE_NAME}`,
    );
    if (isProjectFolder) {
      await window.electronAPI?.showNativeMessageBox?.({
        type: 'warning',
        title: 'That folder is a project',
        message: `${folder}\n\nThis folder is already a Le Jean-Baptiste project. Choose a different folder for your entity database — you can keep it as the parent of your projects, just not a project folder itself.`,
        buttons: ['OK'],
      });
      return null;
    }

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
      if (!(await confirmCreateEntityDb(folder))) return null;
      try {
        await window.electronAPI?.createEntityDatabase?.(folder, createEntitiesScaffold());
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        await window.electronAPI?.showNativeMessageBox?.({
          type: 'warning',
          title: 'Could not create entity database',
          message: `${folder}\n\nLe Jean-Baptiste could not set up the entity database in this folder.`,
          detail,
          buttons: ['OK'],
        });
        return null;
      }
    }

    try {
      await window.electronAPI?.setEntityDbFolder?.(picked);
    } catch (error) {
      // Still reflect the pick in the UI (and let the caller proceed) even if
      // persisting it failed - otherwise a prefs-write error here silently
      // reverts the folder field to empty with no explanation, and since
      // Settings/onboarding requires a folder before Save enables, the user
      // is stuck with no visible cause. Surface the actual error instead.
      const detail = error instanceof Error ? error.message : String(error);
      void window.electronAPI?.showNativeMessageBox?.({
        type: 'warning',
        title: 'Could not save entity database folder',
        message: `${folder}\n\nThe folder was set for this session, but saving it failed and it may not persist. Try again, or check that Le Jean-Baptiste can write to its app data folder.`,
        detail,
        buttons: ['OK'],
      });
    }
    setEntityDbFolderState(picked);
    return picked;
  }, [confirmCreateEntityDb]);

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
      if (result.ok && options.enabled) {
        await afterAuthorityPackLifecycleSuccess();
      }
      await refreshAuthorityLifecycle();
      return result;
    },
    [refreshAuthorityLifecycle],
  );

  const setAuthorityLifecycleReferenceDataEnabled = useCallback(
    async (enabled: boolean): Promise<AuthorityLifecycleRunResult> => {
      const result =
        (await window.electronAPI?.authorityLifecycleSetReferenceDataEnabled?.(enabled)) ?? {
          ok: false,
          error: 'Authority lifecycle bridge is unavailable.',
        };
      if (result.ok && enabled) {
        await afterAuthorityPackLifecycleSuccess();
      }
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
      if (result.ok) {
        await afterAuthorityPackLifecycleSuccess();
      }
      await refreshAuthorityLifecycle();
      return result;
    }, [refreshAuthorityLifecycle]);

  const revealAuthorityLifecycleFolder = useCallback(async () => {
    await window.electronAPI?.authorityLifecycleRevealFolder?.();
  }, []);

  const moveEntityDbFolder = useCallback(async (): Promise<{
    ok: boolean;
    cancelled?: boolean;
    error?: string;
    folder?: string;
  }> => {
    const result = await window.electronAPI?.moveEntityDbFolder?.();
    if (!result) {
      return { ok: false, error: 'Desktop entity database bridge is unavailable.' };
    }
    if (result.ok && result.folder) {
      setEntityDbFolderState(result.folder);
      clearAchievementsCache();
      await refreshAuthorityLifecycle();
    }
    return result;
  }, [refreshAuthorityLifecycle]);

  useEffect(() => {
    if (!isDesktop()) return;
    registerLeafWriterCommonsI18n();

    window.__ljbCommonsUi = {
      encoderName,
      encoderNameLoaded,
      aiApiSettings,
      githubConnected,
      connectGithub,
      disconnectGithub,
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
      setAuthorityLifecycleReferenceDataEnabled,
      runAuthorityLifecycleUpdate,
      revealAuthorityLifecycleFolder,
      moveEntityDbFolder,
    };

    window.dispatchEvent(new Event('ljbCommonsUiChanged'));

    return () => {
      delete window.__ljbCommonsUi;
    };
  }, [
    aiApiSettings,
    connectGithub,
    disconnectGithub,
    githubConnected,
    authorityLifecycleStatus,
    encoderName,
    encoderNameLoaded,
    entityDbFolder,
    rememberWorkspaceOnStartup,
    pickEntityDbFolder,
    refreshAuthorityLifecycle,
    runAuthorityLifecycleUpdate,
    revealAuthorityLifecycleFolder,
    moveEntityDbFolder,
    openDialog,
    setAiApiSettings,
    setAuthorityLifecycleEnabled,
    setAuthorityLifecycleReferenceDataEnabled,
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
