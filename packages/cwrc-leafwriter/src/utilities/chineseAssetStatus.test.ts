import {
  checkChineseProjectAssets,
  EXPECTED_CHINESE_PLUGIN_IDS,
  pluginSupportsChinese,
} from './chineseAssetStatus';

describe('pluginSupportsChinese', () => {
  it('matches zh / lzh language declarations', () => {
    expect(pluginSupportsChinese({ languages: ['zh-Hant'] })).toBe(true);
    expect(pluginSupportsChinese({ languages: ['lzh'] })).toBe(true);
    expect(
      pluginSupportsChinese({
        manifest: { languagePrompt: { documentLanguages: ['zh-Hans'] } },
      }),
    ).toBe(true);
  });

  it('ignores broken plugins and non-Chinese languages', () => {
    expect(pluginSupportsChinese({ languages: ['zh-Hant'], manifestError: 'bad' })).toBe(false);
    expect(pluginSupportsChinese({ languages: ['ja'] })).toBe(false);
  });
});

describe('checkChineseProjectAssets', () => {
  const originalApi = window.electronAPI;

  beforeEach(() => {
    window.localStorage.removeItem('ljb.assets.openccScript.v1');
  });

  afterEach(() => {
    window.electronAPI = originalApi;
  });

  const stubApi = (overrides: {
    packsInstalled?: boolean;
    mapInstalled?: boolean;
    plugins?: {
      id: string;
      enabled?: boolean;
      languages?: string[];
      manifestError?: string | null;
    }[];
  }) => {
    window.electronAPI = {
      authorityPackStatuses: async () => [
        { id: 'chgis-places', installed: overrides.packsInstalled ?? true },
      ],
      mapTilesStatus: async () => ({
        regions: overrides.mapInstalled === false ? [] : [{ id: 'china' }],
      }),
      pluginsGetSnapshot: async () => ({
        plugins: overrides.plugins ?? [],
        state: { enabled: [], dismissedLanguagePrompts: [] },
      }),
    } as typeof window.electronAPI;
  };

  it('requires both Norbert and East Asian dates before plugins count as installed', async () => {
    stubApi({
      plugins: [{ id: 'norbert', enabled: false, languages: ['zh-Hant'] }],
    });

    const partial = await checkChineseProjectAssets();
    expect(partial.pluginsInstalled).toBe(false);
    expect(partial.missingAssets).toContain('plugins');

    stubApi({
      plugins: EXPECTED_CHINESE_PLUGIN_IDS.map((id) => ({
        id,
        enabled: false,
        languages: ['zh-Hant'],
      })),
    });

    const complete = await checkChineseProjectAssets();
    expect(complete.pluginsInstalled).toBe(true);
    expect(complete.missingAssets).not.toContain('plugins');
  });

  it('lists plugins as missing when no Chinese plugin is on disk', async () => {
    stubApi({
      plugins: [{ id: 'cjk-dates', enabled: true, languages: ['ja'] }],
    });

    const result = await checkChineseProjectAssets();
    // ja-only install is not the expected Chinese pair (norbert + cjk-dates).
    expect(result.pluginsInstalled).toBe(false);
    expect(result.missingAssets).toContain('plugins');
  });

  it('still reports other missing assets independently', async () => {
    stubApi({
      packsInstalled: false,
      mapInstalled: false,
      plugins: EXPECTED_CHINESE_PLUGIN_IDS.map((id) => ({
        id,
        enabled: true,
        languages: ['zh-Hant'],
      })),
    });

    const result = await checkChineseProjectAssets();
    expect(result.missingAssets).toEqual(['authorityPacks', 'mapTiles', 'scriptNormalization']);
  });
});
