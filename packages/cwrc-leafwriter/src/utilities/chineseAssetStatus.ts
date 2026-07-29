/**
 * Check which assets are missing for a Chinese-language project.
 * Returns a list of missing asset types that should be downloaded.
 */
export type MissingAssetType = 'authorityPacks' | 'chgis' | 'mapTiles' | 'plugins';

export interface ChineseProjectAssets {
  missingAssets: MissingAssetType[];
  authorityPacksInstalled: boolean;
  chgisInstalled: boolean;
  mapTilesInstalled: boolean;
  pluginsInstalled: boolean;
}

export async function checkChineseProjectAssets(): Promise<ChineseProjectAssets> {
  const result: ChineseProjectAssets = {
    missingAssets: [],
    authorityPacksInstalled: false,
    chgisInstalled: false,
    mapTilesInstalled: false,
    pluginsInstalled: false,
  };

  try {
    // Check authority packs
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
    // Check CHGIS
    const chgisStatus = await window.electronAPI?.authorityChgisGet?.();
    if (chgisStatus?.installed) {
      result.chgisInstalled = true;
    } else {
      result.missingAssets.push('chgis');
    }
  } catch {
    result.missingAssets.push('chgis');
  }

  try {
    // Check map tiles
    const mapStatus = await window.electronAPI?.mapTilesStatus?.();
    if (mapStatus?.installed) {
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
    if (pluginsSnapshot && pluginsSnapshot.state.enabled.length > 0) {
      result.pluginsInstalled = true;
    } else {
      result.missingAssets.push('plugins');
    }
  } catch {
    result.missingAssets.push('plugins');
  }

  return result;
}
