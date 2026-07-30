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
    // Check authority packs (CBDB, DILA, CHGIS, Wikidata — installed together as the `chinese` profile)
    const packStatuses = await window.electronAPI?.authorityPackStatuses?.();
    if (packStatuses && packStatuses.length > 0) {
      result.authorityPacksInstalled = packStatuses.some((p) => p.installed);
    }
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
