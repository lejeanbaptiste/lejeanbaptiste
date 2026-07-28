import {
  findLanguagePromptForDocumentLanguage,
  refreshPluginRegistry,
} from '../../../../packages/cwrc-leafwriter/src/plugins';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';

/** Load plugin registry on desktop startup and optionally nudge for language-matched plugins. */
export interface PluginLanguagePrompt {
  message: string;
  pluginId: string;
}

export function usePluginBootstrap(
  documentLanguage?: string,
  notify?: (prompt: PluginLanguagePrompt) => void,
) {
  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.pluginsGetSnapshot) return;
    void (async () => {
      await refreshPluginRegistry();
      const detectedLanguage =
        documentLanguage ??
        (await window.__leafWriterProject?.getProjectSourceLanguage?.()) ??
        undefined;
      const prompt = findLanguagePromptForDocumentLanguage(detectedLanguage);
      if (!prompt || !notify) return;
      notify(prompt);
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
