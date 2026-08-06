/**
 * Install and enable plugins whose manifests match a language predicate.
 * Used when accepting language asset packs (Chinese chooser, Japanese packs).
 */

import { clearPackContentCache } from '../../../../packages/cwrc-leafwriter/src/services/authority-pack-lookup';
import { refreshPluginRegistry } from '../../../../packages/cwrc-leafwriter/src/plugins/registry';

type LanguageMatcher = (language: string) => boolean;

const pluginMatchesLanguage = (
  plugin: {
    languages?: string[];
    manifest?: { languagePrompt?: { documentLanguages?: string[] } };
  },
  matches: LanguageMatcher,
): boolean =>
  (plugin.languages ?? []).some(matches) ||
  (plugin.manifest?.languagePrompt?.documentLanguages ?? []).some(matches);

/** Load newly enabled plugin modules into the running editor (toolbar, etc.). */
export const refreshPluginsInRenderer = async (): Promise<void> => {
  clearPackContentCache();
  try {
    await refreshPluginRegistry();
  } catch (error) {
    console.warn('[plugins] Failed to refresh plugin registry after install/enable', error);
  }
};

/**
 * Enable matching installed plugins, then remote-install + enable any that are
 * still missing. Failures for one plugin do not block the others (a large
 * cjk-dates download must not leave Norbert un-enabled, and vice versa).
 * Always refreshes the renderer registry afterward so toolbar UI appears
 * without an app restart.
 */
export const ensureLanguagePlugins = async (matches: LanguageMatcher): Promise<void> => {
  const api = window.electronAPI;
  if (!api?.pluginsGetSnapshot) return;

  let snapshot = await api.pluginsGetSnapshot();
  for (const plugin of snapshot.plugins) {
    if (!pluginMatchesLanguage(plugin, matches)) continue;
    if (plugin.enabled) continue;
    try {
      snapshot = (await api.pluginsSetEnabled?.(plugin.id, true)) ?? snapshot;
    } catch (error) {
      console.warn(`[plugins] Failed to enable ${plugin.id}`, error);
    }
  }

  try {
    const remote = await api.pluginsGetRemoteIndex?.();
    if (remote && api.pluginsInstallRemote) {
      for (const entry of remote.plugins) {
        if (!(entry.languages ?? []).some(matches)) continue;
        if (snapshot.plugins.some((plugin) => plugin.id === entry.id)) continue;
        try {
          snapshot = await api.pluginsInstallRemote(entry);
          snapshot = (await api.pluginsSetEnabled?.(entry.id, true)) ?? snapshot;
        } catch (error) {
          console.warn(`[plugins] Failed to install/enable remote plugin ${entry.id}`, error);
        }
      }
    }
  } catch (error) {
    console.warn('[plugins] Failed to fetch remote plugin index', error);
  }

  await refreshPluginsInRenderer();
};
