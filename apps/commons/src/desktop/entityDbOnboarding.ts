import { isDesktop } from '@src/types/desktop';
import { openApplicationSettingsAndWait } from './openApplicationSettings';

/**
 * Ensure the app-level central entity database folder exists. Rather than a
 * dedicated pop-up, this opens the settings panel directly: it blocks closing
 * until language, user name, and database folder are all set (see the
 * settings dialog's onBeforeClose gating), so callers can await it exactly
 * like the old blocking prompt.
 */
export const ensureEntityDbFolder = async (): Promise<boolean> => {
  if (!isDesktop() || !window.electronAPI) return true;

  const existing = await window.electronAPI.getEntityDbFolder?.();
  if (existing?.trim()) return true;

  return openApplicationSettingsAndWait();
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
