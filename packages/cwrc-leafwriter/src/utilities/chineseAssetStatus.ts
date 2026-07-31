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
    // Check plugins — snapshot shape is `{ plugins, state: { enabled: string[] } }`,
    // not a top-level `enabled` map.
    const pluginsSnapshot = await window.electronAPI?.pluginsGetSnapshot?.();
    const chinesePluginEnabled = pluginsSnapshot?.plugins.some(
      (plugin) =>
        plugin.enabled &&
        ((plugin.languages ?? []).some((language) => language.toLowerCase().startsWith('zh')) ||
          (plugin.manifest?.languagePrompt?.documentLanguages ?? []).some((language) =>
            language.toLowerCase().startsWith('zh'),
          )),
    );
    if (chinesePluginEnabled) {
      result.pluginsInstalled = true;
    } else {
      result.missingAssets.push('plugins');
    }
  } catch {
    result.missingAssets.push('plugins');
  }

  return result;
}
