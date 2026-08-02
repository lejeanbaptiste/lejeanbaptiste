/**
 * Check which assets are missing for a Chinese-language project.
 * Returns a list of missing asset types that should be downloaded.
 */
export type MissingAssetType = 'authorityPacks' | 'mapTiles' | 'plugins';

export interface ChineseProjectAssets {
  missingAssets: MissingAssetType[];
  authorityPacksInstalled: boolean;
  mapTilesInstalled: boolean;
  pluginsInstalled: boolean;
}

const isChineseRelatedLanguage = (language: string): boolean => {
  const normalized = language.toLowerCase();
  return normalized.startsWith('zh') || normalized === 'lzh';
};

/** True when a plugin declares Chinese / literary Chinese support. */
export function pluginSupportsChinese(plugin: {
  languages?: string[];
  manifest?: { languagePrompt?: { documentLanguages?: string[] } };
  manifestError?: string | null;
}): boolean {
  if (plugin.manifestError) return false;
  return (
    (plugin.languages ?? []).some(isChineseRelatedLanguage) ||
    (plugin.manifest?.languagePrompt?.documentLanguages ?? []).some(isChineseRelatedLanguage)
  );
}

export async function checkChineseProjectAssets(): Promise<ChineseProjectAssets> {
  const result: ChineseProjectAssets = {
    missingAssets: [],
    authorityPacksInstalled: false,
    mapTilesInstalled: false,
    pluginsInstalled: false,
  };

  try {
    // The Chinese bundle contains several packs. Require CHGIS specifically so
    // existing installations with only the older CBDB/DILA packs are prompted
    // to receive the newly bundled CHGIS pack.
    const packStatuses = await window.electronAPI?.authorityPackStatuses?.();
    result.authorityPacksInstalled =
      packStatuses?.some((p) => p.id === 'chgis-places' && p.installed) ?? false;
    if (!result.authorityPacksInstalled) {
      result.missingAssets.push('authorityPacks');
    }
  } catch {
    result.missingAssets.push('authorityPacks');
  }

  try {
    // Check map tiles
    const mapStatus = await window.electronAPI?.mapTilesStatus?.();
    if (mapStatus?.regions?.some((region) => region.id === 'china')) {
      result.mapTilesInstalled = true;
    } else {
      result.missingAssets.push('mapTiles');
    }
  } catch {
    result.missingAssets.push('mapTiles');
  }

  try {
    // Plugins are installed app-wide; `enabled` is per-project. Only prompt to
    // *download* when no matching Chinese plugin is on disk — a fresh Chinese
    // project that simply hasn't enabled Norbert/cjk-dates yet is not "missing"
    // the plugins.
    const pluginsSnapshot = await window.electronAPI?.pluginsGetSnapshot?.();
    result.pluginsInstalled =
      pluginsSnapshot?.plugins.some((plugin) => pluginSupportsChinese(plugin)) ?? false;
    if (!result.pluginsInstalled) {
      result.missingAssets.push('plugins');
    }
  } catch {
    result.missingAssets.push('plugins');
  }

  return result;
}
