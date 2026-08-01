/**
 * Prompt on Chinese-project open for the remaining downloadable assets
 * (authority packs — CBDB/DILA/CHGIS/Wikidata —, map tiles, plugins) that
 * aren't already installed.
 * Runs once per project open, after `<ProjectEditor>` has mounted so the
 * dialog can be shown through the embedded overmind store.
 */

import { checkChineseProjectAssets } from '../../../../packages/cwrc-leafwriter/src/utilities/chineseAssetStatus';
import { isChineseEnabled } from './projectLanguage';
import type { ProjectBundle } from './projectFile';
import { isDesktop } from '@src/types/desktop';
import { regionalBundleForLanguage } from '../../../../packages/cwrc-leafwriter/src/autoTagging/mapView/regionalBundles';
import type { MissingAssetType } from '../../../../packages/cwrc-leafwriter/src/utilities/chineseAssetStatus';
import type { DialogBarProps } from '../dialogs';
import { refreshCbdbConcordanceAfterPackLifecycle } from '../../../../packages/cwrc-leafwriter/src/autoTagging/cbdbConcordance';
import { clearPackContentCache } from '../../../../packages/cwrc-leafwriter/src/services/authority-pack-lookup';
import { ensureLanguagePlugins } from './ensureLanguagePlugins';

const isChineseRelatedLanguage = (language: string): boolean =>
  language.toLowerCase().startsWith('zh') || language.toLowerCase() === 'lzh';

const downloadChineseMapTiles = async (): Promise<void> => {
  const api = window.electronAPI;
  const bundle = regionalBundleForLanguage('zh');
  if (bundle && api?.mapTilesDownloadBackground) await api.mapTilesDownloadBackground(bundle);
};

const downloadSelectedChineseAssets = async (selected: MissingAssetType[]): Promise<void> => {
  const api = window.electronAPI;
  const choices = new Set(selected);
  const tasks: Promise<unknown>[] = [];
  if (choices.has('authorityPacks')) {
    tasks.push(
      (async () => {
        await (api?.authorityLifecycleSetEnabled?.({ enabled: true, profile: 'chinese' }) ??
          Promise.resolve());
        clearPackContentCache();
        try {
          await refreshCbdbConcordanceAfterPackLifecycle();
        } catch {
          // Pack enable succeeded; panel reload remains the safety net.
        }
      })(),
    );
  }
  if (choices.has('plugins')) tasks.push(ensureLanguagePlugins(isChineseRelatedLanguage));
  if (choices.has('mapTiles')) tasks.push(downloadChineseMapTiles());
  await Promise.allSettled(tasks);
};

export const maybeOfferChineseAssetDownloads = async (
  bundle: ProjectBundle,
  openDialog: (dialog: DialogBarProps) => void,
): Promise<void> => {
  if (!isDesktop() || !window.electronAPI) return;
  if (!(await isChineseEnabled(bundle))) return;

  const { missingAssets } = await checkChineseProjectAssets();
  if (missingAssets.length === 0) return;

  openDialog({
    type: 'chineseAssets',
    props: {
      id: 'chinese-assets-prompt',
      missingAssets,
      onClose: async (action, data) => {
        if (action !== 'download') return;
        const selected = (data as { selected?: MissingAssetType[] } | undefined)?.selected ?? [];
        await downloadSelectedChineseAssets(selected);
      },
    },
  });
};
