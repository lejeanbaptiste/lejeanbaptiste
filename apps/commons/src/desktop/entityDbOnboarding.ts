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

export const projectHasEntityStorePreference = async (
  projectFilePath: string,
): Promise<boolean> => {
  if (!window.electronAPI?.readFile) return true;
  try {
    const raw = JSON.parse(await window.electronAPI.readFile(projectFilePath)) as Record<
      string,
      unknown
    >;
    return Object.prototype.hasOwnProperty.call(raw, 'entityStore');
  } catch {
    return true;
  }
};
