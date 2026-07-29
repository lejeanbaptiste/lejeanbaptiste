/**
 * Prompt on Chinese-project open for the remaining downloadable assets
 * (authority packs, CHGIS, map tiles, plugins) that aren't already installed.
 * Runs once per project open, after `<ProjectEditor>` has mounted so the
 * dialog can be shown through the embedded overmind store.
 */

import { checkChineseProjectAssets } from '../../../../packages/cwrc-leafwriter/src/utilities/chineseAssetStatus';
import { isChineseEnabled } from './projectLanguage';
import type { ProjectBundle } from './projectFile';
import { isDesktop } from '@src/types/desktop';

export const maybeOfferChineseAssetDownloads = async (bundle: ProjectBundle): Promise<void> => {
  if (!isDesktop() || !window.electronAPI) return;
  if (!(await isChineseEnabled(bundle))) return;

  const { missingAssets } = await checkChineseProjectAssets();
  if (missingAssets.length === 0) return;

  window.writer?.overmindActions?.ui?.openDialog?.({
    type: 'chineseAssets',
    props: {
      id: 'chinese-assets-prompt',
      missingAssets,
    },
  });
};
