import { isDesktop } from '@src/types/desktop';

/** App-level settings (theme, language, warnings) — no document required. */
export const openNativeSettings = async (): Promise<boolean> => {
  if (!isDesktop() || !window.electronAPI?.openNativeDialog) return false;

  await window.electronAPI.openNativeDialog({
    id: 'settings',
    type: 'settings',
    title: 'Settings',
  });
  return true;
};
