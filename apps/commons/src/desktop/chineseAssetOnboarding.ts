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
import { installScriptNormalization } from '../../../../packages/cwrc-leafwriter/src/layout/entityFields/openccScriptNormalize';

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
  if (choices.has('scriptNormalization')) tasks.push(installScriptNormalization());
  await Promise.allSettled(tasks);
};

export const maybeOfferChineseAssetDownloads = async (
  bundle: ProjectBundle,
  openDialog: (dialog: DialogBarProps) => void,
): Promise<void> => {
  if (!isDesktop() || !window.electronAPI) return;
  if (!(await isChineseEnabled(bundle))) return;

  const api = window.electronAPI;

  // Enable (and try to remote-fill) Chinese language plugins first. A machine
  // that already has Norbert must still pull East Asian dates when missing —
  // checkChineseProjectAssets treats both as required.
  try {
    await ensureLanguagePlugins(isChineseRelatedLanguage);
    if (api.pluginsEnsureSchemaContribution) {
      const mergeResult = await api.pluginsEnsureSchemaContribution(
        'cjk-dates',
        bundle.projectFilePath,
      );
      if (mergeResult?.merged && window.writer) {
        await window.writer.overmindActions?.validator?.clearCache?.();
        window.writer.schemaManager?.clearSchemaRevision?.();
      }
    }
  } catch (error) {
    console.warn('[onboarding] Failed to enable Chinese language plugins', error);
  }

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
        if (selected.includes('plugins') && api.pluginsEnsureSchemaContribution) {
          try {
            const mergeResult = await api.pluginsEnsureSchemaContribution(
              'cjk-dates',
              bundle.projectFilePath,
            );
            if (mergeResult?.merged && window.writer) {
              await window.writer.overmindActions?.validator?.clearCache?.();
              window.writer.schemaManager?.clearSchemaRevision?.();
            }
          } catch (error) {
            console.warn('[onboarding] Failed to merge cjk-dates schema contribution', error);
          }
        }
      },
    },
  });
};
