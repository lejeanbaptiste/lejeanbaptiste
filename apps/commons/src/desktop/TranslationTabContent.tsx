import { Box, LinearProgress, Typography } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getActiveProjectBundle } from './activeProjectBundle';
import { installCitationBridge } from './citations/citationBridge';
import { getProjectSourceLanguage } from './projectLanguage';
import { startTranslationForLang } from './translationEntry';
import { readTranslationSettings } from './translationSettings';
import type { TranslationLanguage } from './translationTypes';

declare global {
  interface Window {
    __desktopTranslationLanguageState?: {
      indexing: boolean;
      languages: TranslationLanguage[];
      projectSourceLang: string | null;
      selectedLang: string;
      setSelectedLang: (lang: string) => void;
    };
  }
}

/** Tells the file watcher this specific write was expected, matching the app's own save flow. */
const ignoreSavedFileChange = async (filePath: string) => {
  if (!window.electronAPI?.statFile || !window.electronAPI?.ignoreFileChange) return;
  try {
    const { mtimeMs } = await window.electronAPI.statFile(filePath);
    await window.electronAPI.ignoreFileChange(filePath, mtimeMs);
  } catch {
    // ignore
  }
};

interface TranslationTabContentProps {
  /** Whether this tab is currently the visible one in the right panel. */
  active: boolean;
}

export const TranslationTabContent = ({ active }: TranslationTabContentProps) => {
  const { t } = useTranslation();
  const { activeTabPath, openTabs, projectFilePath } = useAppState().project;
  const { notifyViaSnackbar } = useActions().ui;
  const { reloadTabFromDisk } = useActions().project;

  const [languages, setLanguages] = useState<TranslationLanguage[] | null>(null);
  const [selectedLang, setSelectedLang] = useState<string>('');
  const [projectSourceLang, setProjectSourceLang] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const resolvedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isDesktop()) return;
    return installCitationBridge();
  }, []);

  // Let the save flow know whether it's worth doing any reindex work at all — automatic
  // reindexing only runs while this tab is actually open, to avoid extra cost on every save
  // when translation isn't in use.
  useEffect(() => {
    window.__desktopTranslationTabActive = active;
    return () => {
      window.__desktopTranslationTabActive = false;
    };
  }, [active]);

  useEffect(() => {
    if (!projectFilePath) {
      setProjectSourceLang(null);
      return;
    }
    const bundle = getActiveProjectBundle();
    if (!bundle) {
      setProjectSourceLang(null);
      return;
    }
    let cancelled = false;
    void getProjectSourceLanguage(bundle).then((lang) => {
      if (!cancelled) setProjectSourceLang(lang);
    });
    return () => {
      cancelled = true;
    };
  }, [projectFilePath]);

  useEffect(() => {
    if (!languages) {
      delete window.__desktopTranslationLanguageState;
      window.dispatchEvent(new CustomEvent('desktop:translation-language-state-changed'));
      return;
    }

    window.__desktopTranslationLanguageState = {
      indexing,
      languages,
      projectSourceLang,
      selectedLang,
      setSelectedLang,
    };
    window.dispatchEvent(new CustomEvent('desktop:translation-language-state-changed'));
  }, [indexing, languages, projectSourceLang, selectedLang]);

  useEffect(() => {
    return () => {
      delete window.__desktopTranslationLanguageState;
      window.dispatchEvent(new CustomEvent('desktop:translation-language-state-changed'));
    };
  }, []);

  // Lets other UI (e.g. a Find result inside a translation file) request a specific language
  // be selected, without needing to reach into this component's own state directly.
  useEffect(() => {
    const onRequestLanguage = (event: Event) => {
      const lang = (event as CustomEvent<{ lang?: string }>).detail?.lang;
      if (lang) setSelectedLang(lang);
    };
    window.addEventListener('desktop:translation-request-language', onRequestLanguage);
    return () =>
      window.removeEventListener('desktop:translation-request-language', onRequestLanguage);
  }, []);

  const applyConfiguredLanguages = useCallback(
    async (clearResolvedKey = false) => {
      if (!isDesktop() || !projectFilePath) {
        setLanguages(null);
        return;
      }
      const bundle = getActiveProjectBundle();
      if (!bundle) return;
      const settings = await readTranslationSettings(bundle);
      const nextLanguages = settings?.languages ?? [];
      setLanguages(nextLanguages);
      setSelectedLang((current) =>
        current && nextLanguages.some((lang) => lang.code === current)
          ? current
          : (nextLanguages[0]?.code ?? ''),
      );
      if (clearResolvedKey) resolvedKeyRef.current = null;
    },
    [projectFilePath],
  );

  // Load the project's configured translation languages whenever the project changes.
  useEffect(() => {
    let cancelled = false;
    void applyConfiguredLanguages().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [applyConfiguredLanguages]);

  // Project settings can be saved from the settings dialog or a native window
  // without changing projectFilePath — reload languages when that happens.
  useEffect(() => {
    const onConfigSaved = () => {
      void applyConfiguredLanguages(true);
    };
    window.addEventListener('grognard-project-config-saved', onConfigSaved);
    return () => window.removeEventListener('grognard-project-config-saved', onConfigSaved);
  }, [applyConfiguredLanguages]);

  // Leaving the translation tab calls exitTranslationMode (active → false). Clear the
  // resolved key so coming back re-runs enterTranslationMode; otherwise the pane mounts
  // into an empty portal while Overmind still thinks translation is off (blank panel).
  // Also clear when this tab is merely hidden — exitTranslationMode is a no-op if enter
  // never succeeded (e.g. dirty file), and a stuck key would permanently skip retry.
  useEffect(() => {
    if (!active) resolvedKeyRef.current = null;
  }, [active]);

  useEffect(() => {
    const onModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      if (detail?.active === false) resolvedKeyRef.current = null;
    };
    window.addEventListener('desktop:translation-mode-changed', onModeChanged);
    return () => window.removeEventListener('desktop:translation-mode-changed', onModeChanged);
  }, []);

  // Auto-index: the first time this tab is active for a given (file, language) pair,
  // resolve or create the companion translation file.
  const isActiveTabDirty = openTabs.find((tab) => tab.filePath === activeTabPath)?.dirty ?? false;

  useEffect(() => {
    if (!active || !activeTabPath || !selectedLang) return;
    const key = `${activeTabPath}::${selectedLang}`;
    if (resolvedKeyRef.current === key) return;
    // Hold the key while in flight so overlapping effect runs do not start a second
    // bootstrap. Soft failures clear it so a later dep change can retry (classic case:
    // user saves after "Save this file before starting a translation").
    resolvedKeyRef.current = key;

    setIndexing(true);
    void startTranslationForLang(selectedLang, {
      activeTabPath,
      isActiveTabDirty,
      onEnter: (payload) => {
        const enter = window.writer?.overmindActions?.ui?.enterTranslationMode;
        if (!enter) {
          throw new Error('Translation mode is not available yet. Try again in a moment.');
        }
        enter(payload);
      },
      onSourceFileWritten: async (filePath) => {
        await ignoreSavedFileChange(filePath);
        await reloadTabFromDisk(filePath);
      },
      notify: notifyViaSnackbar,
    })
      .then((entered) => {
        if (!entered) resolvedKeyRef.current = null;
      })
      .catch((error) => {
        resolvedKeyRef.current = null;
        console.error('[translation] startTranslationForLang threw', error);
        notifyViaSnackbar(
          t('LWC.translation.translate_failed', {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      })
      .finally(() => {
        setIndexing(false);
      });
  }, [
    active,
    activeTabPath,
    selectedLang,
    isActiveTabDirty,
    reloadTabFromDisk,
    notifyViaSnackbar,
    t,
  ]);

  if (languages === null) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          {t('LWC.translation.open_project_to_use_translations')}
        </Typography>
      </Box>
    );
  }

  if (languages.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          {t('LWC.translation.no_languages_configured')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {indexing && (
        <Box sx={{ px: 1, py: 2 }}>
          <LinearProgress />
          <Typography color="text.secondary" sx={{ mt: 1 }} variant="caption">
            {t('LWC.translation.indexing_document')}
          </Typography>
        </Box>
      )}
      <Box
        id="desktop-panel-translation"
        sx={{ flex: 1, minHeight: 0, display: indexing ? 'none' : 'block' }}
      />
    </Box>
  );
};
