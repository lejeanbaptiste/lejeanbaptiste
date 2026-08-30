import { refreshPluginRegistry } from '../../../../packages/cwrc-leafwriter/src/plugins';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';
import { documentLanguageMatchesPlugin } from './pluginLanguage';

/** @deprecated Kept for call-site compatibility; installed plugins are enabled quietly. */
export interface PluginLanguagePrompt {
  message: string;
  pluginId: string;
}

/**
 * Load the plugin registry on desktop startup and align the project's enabled
 * plugins with its source language: installed plugins that match are enabled —
 * no download / availability dialog — and language-specific plugins that no
 * longer match are disabled, so a project switched away from, say, Chinese does
 * not keep offering Chinese-only menu items. Plugins that declare no language
 * are universal and are never touched. Missing plugins are offered by
 * Chinese/Japanese asset onboarding instead.
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

      let changedAny = false;
      for (const plugin of snapshot.plugins) {
        if (plugin.manifestError) continue;
        const langs = plugin.manifest?.languagePrompt?.documentLanguages ?? plugin.languages ?? [];
        if (langs.length === 0) continue;
        const matches = documentLanguageMatchesPlugin(detectedLanguage, langs);
        if (matches === plugin.enabled) continue;
        try {
          await window.electronAPI?.pluginsSetEnabled?.(plugin.id, matches);
          changedAny = true;
        } catch (error) {
          console.warn(
            `[plugins] Failed to ${matches ? 'enable' : 'disable'} ${plugin.id} during bootstrap`,
            error,
          );
        }
      }
      if (changedAny) await refreshPluginRegistry();
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
