import {
  findLanguagePromptForDocumentLanguage,
  refreshPluginRegistry,
} from '../../../../packages/cwrc-leafwriter/src/plugins';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';

/** Load plugin registry on desktop startup and optionally nudge for language-matched plugins. */
export function usePluginBootstrap(documentLanguage?: string, notify?: (message: string) => void) {
  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.pluginsGetSnapshot) return;
    void (async () => {
      await refreshPluginRegistry();
      const prompt = findLanguagePromptForDocumentLanguage(documentLanguage);
      if (!prompt || !notify) return;
      notify(prompt.message);
      await window.electronAPI?.pluginsDismissLanguagePrompt?.(prompt.pluginId);
    })();
  }, [documentLanguage, notify]);
}

export function openPluginsDialog() {
  if (window.writer?.overmindActions?.ui?.openDialog) {
    window.writer.overmindActions.ui.openDialog({ type: 'plugins' });
    return true;
  }
  return false;
}
