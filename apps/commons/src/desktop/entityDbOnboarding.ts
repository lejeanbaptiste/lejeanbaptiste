import { isDesktop } from '@src/types/desktop';

/** Ensure the app-level central entity database folder exists. */
export const ensureEntityDbFolder = async (): Promise<boolean> => {
  if (!isDesktop() || !window.electronAPI) return true;

  const existing = await window.electronAPI.getEntityDbFolder?.();
  if (existing?.trim()) return true;

  // Explain before showing the bare folder picker (its `message` option is macOS-only).
  if (window.electronAPI.showNativeMessageBox) {
    const { response } = await window.electronAPI.showNativeMessageBox({
      type: 'info',
      title: 'Entity database folder',
      message: 'Choose a folder for your entity database.',
      detail:
        'Le Jean-Baptiste keeps named entities (people, places, organizations…) in a central database (entities.xml). Offline authority packs are also stored there. You can keep your projects in the same folder.',
      buttons: ['Choose folder…', 'Not now'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response !== 0) return false;
  }

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
