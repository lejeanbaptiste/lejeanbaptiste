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

const isChineseRelatedLanguage = (language: string): boolean =>
  language.toLowerCase().startsWith('zh');

const downloadChinesePlugins = async (): Promise<void> => {
  const api = window.electronAPI;
  if (!api?.pluginsGetSnapshot) return;
  let snapshot = await api.pluginsGetSnapshot();
  const installed = snapshot.plugins.filter((plugin) =>
    (plugin.languages ?? []).some(isChineseRelatedLanguage) ||
    (plugin.manifest?.languagePrompt?.documentLanguages ?? []).some(isChineseRelatedLanguage),
  );
  for (const plugin of installed) {
    if (!plugin.enabled) snapshot = await api.pluginsSetEnabled?.(plugin.id, true) ?? snapshot;
  }
  const remote = await api.pluginsGetRemoteIndex?.();
  if (!remote || !api.pluginsInstallRemote) return;
  for (const entry of remote.plugins) {
    if (!(entry.languages ?? []).some(isChineseRelatedLanguage)) continue;
    if (snapshot.plugins.some((plugin) => plugin.id === entry.id)) continue;
    snapshot = await api.pluginsInstallRemote(entry);
    snapshot = await api.pluginsSetEnabled?.(entry.id, true) ?? snapshot;
  }
};

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
  if (choices.has('plugins')) tasks.push(downloadChinesePlugins());
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
