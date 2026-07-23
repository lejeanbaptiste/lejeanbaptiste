import { isDesktop } from '@src/types/desktop';

/**
 * Ensure the app-level central entity database folder exists. The folder is
 * auto-created under a fixed app-data default on first access (see
 * getEntityDbFolder in projectPrefs.ts), so this just makes sure that has
 * happened before callers proceed.
 */
export const ensureEntityDbFolder = async (): Promise<boolean> => {
  if (!isDesktop() || !window.electronAPI) return true;

  await window.electronAPI.getEntityDbFolder?.();
  return true;
};
