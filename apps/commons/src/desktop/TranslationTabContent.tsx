import { Box, LinearProgress, Typography } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useEffect, useRef, useState } from 'react';
import { getActiveProjectBundle } from './activeProjectBundle';
import { startTranslationForLang } from './translationEntry';
import { readTranslationSettings } from './translationSettings';
import type { TranslationLanguage } from './translationTypes';

declare global {
  interface Window {
    __desktopTranslationLanguageState?: {
      indexing: boolean;
      languages: TranslationLanguage[];
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
  const { activeTabPath, openTabs, projectFilePath } = useAppState().project;
  const { notifyViaSnackbar } = useActions().ui;
  const { reloadTabFromDisk } = useActions().project;

  const [languages, setLanguages] = useState<TranslationLanguage[] | null>(null);
  const [selectedLang, setSelectedLang] = useState<string>('');
  const [indexing, setIndexing] = useState(false);
  const resolvedKeyRef = useRef<string | null>(null);

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
    if (!languages) {
      delete window.__desktopTranslationLanguageState;
      window.dispatchEvent(new CustomEvent('desktop:translation-language-state-changed'));
      return;
    }

    window.__desktopTranslationLanguageState = {
      indexing,
      languages,
      selectedLang,
      setSelectedLang,
    };
    window.dispatchEvent(new CustomEvent('desktop:translation-language-state-changed'));
  }, [indexing, languages, selectedLang]);

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

  // Load the project's configured translation languages whenever the project changes.
  useEffect(() => {
    if (!isDesktop() || !projectFilePath) {
      setLanguages(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const bundle = getActiveProjectBundle();
      if (!bundle) return;
      const settings = await readTranslationSettings(bundle);
      if (cancelled) return;
      setLanguages(settings?.languages ?? []);
      setSelectedLang((current) =>
        current && settings?.languages.some((lang) => lang.code === current)
          ? current
          : (settings?.languages[0]?.code ?? ''),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [projectFilePath]);

  // Auto-index: the first time this tab is active for a given (file, language) pair,
  // resolve or create the companion translation file.
  useEffect(() => {
    if (!active || !activeTabPath || !selectedLang) return;
    const key = `${activeTabPath}::${selectedLang}`;
    if (resolvedKeyRef.current === key) return;
    resolvedKeyRef.current = key;

    const isActiveTabDirty = openTabs.find((tab) => tab.filePath === activeTabPath)?.dirty ?? false;

    setIndexing(true);
    void startTranslationForLang(selectedLang, {
      activeTabPath,
      isActiveTabDirty,
      onEnter: (payload) => {
        window.writer?.overmindActions?.ui?.enterTranslationMode?.(payload);
      },
      onSourceFileWritten: async (filePath) => {
        await ignoreSavedFileChange(filePath);
        await reloadTabFromDisk(filePath);
      },
      notify: notifyViaSnackbar,
    })
      .catch((error) => {
        resolvedKeyRef.current = null;
        console.error('[translation] startTranslationForLang threw', error);
        notifyViaSnackbar(
          `Translate failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        setIndexing(false);
      });
  }, [active, activeTabPath, selectedLang, openTabs, reloadTabFromDisk, notifyViaSnackbar]);

  if (languages === null) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          Open a project to use translations.
        </Typography>
      </Box>
    );
  }

  if (languages.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          No translation languages configured yet. Add them in Project → Edition metadata…
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
            Indexing document for translation…
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
