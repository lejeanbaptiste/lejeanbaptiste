import { isDesktop } from '@src/types/desktop';

/** Ensure the app-level central entity database folder exists. */
export const ensureEntityDbFolder = async (): Promise<boolean> => {
  if (!isDesktop() || !window.electronAPI) return true;

  const existing = await window.electronAPI.getEntityDbFolder?.();
  if (existing?.trim()) return true;

  const picked = await window.electronAPI.pickEntityDbFolder?.();
  if (!picked) return false;
  await window.electronAPI.setEntityDbFolder?.(picked);
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
