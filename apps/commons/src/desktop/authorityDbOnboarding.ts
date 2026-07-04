/**
 * Prompt-on-first-Chinese-project for the authority databases (Phase A1).
 * Fire-and-forget: the project opens regardless; downloads run in the main
 * process and a system notification reports the result. The main process
 * remembers a decline (marker file next to the databases) so the user isn't
 * nagged on every open; downloads stay available from the authority UI later.
 */

import { isChineseLanguageCode } from '@cwrc/leafwriter/languageCodes';

import { getProjectSourceLanguage } from './projectLanguage';
import type { ProjectBundle } from './projectFile';
import { isDesktop } from '@src/types/desktop';

/**
 * Offer the CBDB/DILA downloads if this is a Chinese project with sources
 * missing. Safe to call on every project open.
 */
export const maybeOfferAuthorityDatabases = async (bundle: ProjectBundle): Promise<void> => {
  if (!isDesktop()) return;
  const api = window.electronAPI;
  if (!api?.authorityDbStatuses || !api.authorityDbPromptDownload || !api.authorityDbDownload) {
    return;
  }

  if (!isChineseLanguageCode(await getProjectSourceLanguage(bundle))) return;

  const statuses = await api.authorityDbStatuses();
  const missing = statuses.filter((status) => !status.installed);
  if (missing.length === 0) return;

  if ((await api.authorityDbPromptDownload()) !== 'accepted') return;

  // Sequential on purpose: CBDB alone is ~600 MB.
  for (const status of missing) {
    await api.authorityDbDownload(status.id);
  }
};
