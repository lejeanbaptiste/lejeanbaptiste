/**
 * Prompt on first Chinese/Japanese project for offline authority packs.
 * Fire-and-forget: the project opens regardless; download/refresh run in the
 * main process and a system notification reports the result.
 */

import i18next from 'i18next';
import {
  isChineseLanguageCode,
  isJapaneseLanguageCode,
  isTibetanLanguageCode,
} from '@cwrc/leafwriter/languageCodes';

import { getProjectSourceLanguage } from './projectLanguage';
import type { ProjectBundle } from './projectFile';
import type { AuthorityLifecyclePromptStrings } from './authorityLifecycleTypes';
import { isDesktop } from '@src/types/desktop';

const { t } = i18next;

const authorityProfileForLanguage = (
  language: string | null | undefined,
): 'chinese' | 'japanese' | 'tibetan' | null => {
  if (isChineseLanguageCode(language)) return 'chinese';
  if (isJapaneseLanguageCode(language)) return 'japanese';
  if (isTibetanLanguageCode(language)) return 'tibetan';
  return null;
};

const promptStringsForProfile = (
  profile: 'chinese' | 'japanese' | 'tibetan',
): AuthorityLifecyclePromptStrings => ({
  message: t(`LWC.desktop.authority_prompt.${profile}.message`),
  detail: t(`LWC.desktop.authority_prompt.${profile}.detail`),
  downloadButton: t('LWC.desktop.authority_prompt.download_button'),
  notNowButton: t('LWC.desktop.authority_prompt.not_now_button'),
});

/**
 * Offer offline authority assets if this is a supported East Asian project and
 * the matching lifecycle is not yet enabled. Safe to call on every project open.
 */
export const maybeOfferAuthorityDatabases = async (bundle: ProjectBundle): Promise<void> => {
  if (!isDesktop()) return;
  const api = window.electronAPI;
  if (!api) return;

  const profile = authorityProfileForLanguage(await getProjectSourceLanguage(bundle));
  if (!profile) return;

  if (api.authorityLifecycleGet && api.authorityLifecyclePromptEnable && api.authorityLifecycleSetEnabled) {
    const status = await api.authorityLifecycleGet();
    const profileStatus = status.profileStatuses?.find((entry) => entry.id === profile);
    if (profileStatus?.enabled) return;
    if (status.declinedFirstPrompt) return;
    if (profileStatus?.packsReady) return;

    if (
      (await api.authorityLifecyclePromptEnable(profile, promptStringsForProfile(profile))) !==
      'accepted'
    )
      return;
    await api.authorityLifecycleSetEnabled({ enabled: true, profile });
    return;
  }

  // Legacy path (Phase A1) when lifecycle IPC is unavailable.
  if (!api.authorityDbStatuses || !api.authorityDbPromptDownload || !api.authorityDbDownload) {
    return;
  }

  const statuses = await api.authorityDbStatuses();
  const missing = statuses.filter((status) => !status.installed);
  if (missing.length === 0) return;

  if ((await api.authorityDbPromptDownload()) !== 'accepted') return;

  for (const status of missing) {
    await api.authorityDbDownload(status.id);
  }
};
