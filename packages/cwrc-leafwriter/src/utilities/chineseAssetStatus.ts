import { isScriptNormalizationInstalled } from '../layout/entityFields/openccScriptNormalize';

/**
 * Check which assets are missing for a Chinese-language project.
 * Returns a list of missing asset types that should be downloaded.
 */
export type MissingAssetType = 'authorityPacks' | 'mapTiles' | 'plugins' | 'scriptNormalization';

export interface ChineseProjectAssets {
  missingAssets: MissingAssetType[];
  authorityPacksInstalled: boolean;
  mapTilesInstalled: boolean;
  pluginsInstalled: boolean;
  scriptNormalizationInstalled: boolean;
}

/**
 * Plugins every Chinese / literary-Chinese project should have on disk.
 * "Plugins installed" means all of these, not merely one — otherwise a machine
 * with only Norbert never re-prompts for East Asian dates (cjk-dates).
 */
export const EXPECTED_CHINESE_PLUGIN_IDS = ['norbert', 'cjk-dates'] as const;

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
    scriptNormalizationInstalled: isScriptNormalizationInstalled(),
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
    // Plugins are installed app-wide; `enabled` is per-project. Prompt to
    // *download* when any expected Chinese plugin is still missing from disk
    // (Norbert alone must not count as complete — East Asian dates is required
    // too). A project that simply hasn't enabled them yet is not "missing".
    const pluginsSnapshot = await window.electronAPI?.pluginsGetSnapshot?.();
    const installedIds = new Set(
      (pluginsSnapshot?.plugins ?? [])
        .filter((plugin) => !plugin.manifestError)
        .map((plugin) => plugin.id),
    );
    result.pluginsInstalled = EXPECTED_CHINESE_PLUGIN_IDS.every((id) => installedIds.has(id));
    if (!result.pluginsInstalled) {
      result.missingAssets.push('plugins');
    }
  } catch {
    result.missingAssets.push('plugins');
  }

  if (!result.scriptNormalizationInstalled) {
    result.missingAssets.push('scriptNormalization');
  }

  return result;
}
