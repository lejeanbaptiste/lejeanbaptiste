import { refreshPluginRegistry } from '../../../../packages/cwrc-leafwriter/src/plugins';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';

/** @deprecated Kept for call-site compatibility; installed plugins are enabled quietly. */
export interface PluginLanguagePrompt {
  message: string;
  pluginId: string;
}

/**
 * Load the plugin registry on desktop startup. Matching language plugins that
 * are already installed are enabled for the current project — no download /
 * availability dialog. Missing plugins are offered by Chinese/Japanese asset
 * onboarding instead.
 */
export function usePluginBootstrap(
  documentLanguage?: string,
  _notify?: (prompt: PluginLanguagePrompt) => void,
) {
  useEffect(() => {
    if (!isDesktop() || !window.electronAPI?.pluginsGetSnapshot) return;
    void (async () => {
      await refreshPluginRegistry();
      const detectedLanguage =
        documentLanguage ??
        (await window.__leafWriterProject?.getProjectSourceLanguage?.()) ??
        undefined;
      if (!detectedLanguage) return;

      const snapshot = await window.electronAPI.pluginsGetSnapshot?.();
      if (!snapshot) return;

      const normalized = detectedLanguage.toLowerCase();
      let enabledAny = false;
      for (const plugin of snapshot.plugins) {
        if (plugin.enabled || plugin.manifestError) continue;
        const langs =
          plugin.manifest?.languagePrompt?.documentLanguages ?? plugin.languages ?? [];
        if (!langs.some((language) => normalized.startsWith(language.toLowerCase()))) continue;
        await window.electronAPI.pluginsSetEnabled?.(plugin.id, true);
        enabledAny = true;
      }
      if (enabledAny) await refreshPluginRegistry();
    })();
  }, [documentLanguage]);
}

export function openPluginsDialog() {
  if (window.writer?.overmindActions?.ui?.openDialog) {
    window.writer.overmindActions.ui.openDialog({
      type: 'settings',
      props: { initialTab: 'plugins' },
    });
    return true;
  }
  return false;
}
