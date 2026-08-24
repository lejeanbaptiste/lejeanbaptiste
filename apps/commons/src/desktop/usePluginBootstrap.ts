import { refreshPluginRegistry } from '../../../../packages/cwrc-leafwriter/src/plugins';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';

/** @deprecated Kept for call-site compatibility; installed plugins are enabled quietly. */
export interface PluginLanguagePrompt {
  message: string;
  pluginId: string;
}

/**
 * True when a project source language matches a plugin language tag.
 * Either side may be a prefix of the other so project `zh` matches plugin
 * `zh-hant`, and project `zh-Hant` matches a bare `zh` declaration.
 */
const documentLanguageMatchesPlugin = (
  documentLanguage: string,
  pluginLanguages: string[],
): boolean => {
  const normalized = documentLanguage.toLowerCase();
  return pluginLanguages.some((language) => {
    const candidate = language.toLowerCase();
    return (
      normalized === candidate ||
      normalized.startsWith(`${candidate}-`) ||
      candidate.startsWith(normalized) ||
      candidate.startsWith(`${normalized}-`)
    );
  });
};

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

      const snapshot = await window.electronAPI?.pluginsGetSnapshot?.();
      if (!snapshot) return;

      let enabledAny = false;
      for (const plugin of snapshot.plugins) {
        if (plugin.enabled || plugin.manifestError) continue;
        const langs = plugin.manifest?.languagePrompt?.documentLanguages ?? plugin.languages ?? [];
        if (!documentLanguageMatchesPlugin(detectedLanguage, langs)) continue;
        try {
          await window.electronAPI?.pluginsSetEnabled?.(plugin.id, true);
          enabledAny = true;
        } catch (error) {
          console.warn(`[plugins] Failed to enable ${plugin.id} during bootstrap`, error);
        }
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
