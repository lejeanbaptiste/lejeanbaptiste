import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

import type { AppUpdateCheckResult } from '../../commons/src/desktop/appUpdateTypes';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/**
 * Auto-updates from GitHub releases (electron-updater reads the embedded
 * app-update.yml generated from the electron-builder `publish` config).
 * macOS updates via the zip target; the pkg is only the first install.
 */
export const initAutoUpdater = (): (() => void) => {
  if (!app.isPackaged) return () => undefined;
  if (process.platform !== 'darwin' && process.platform !== 'win32') return () => undefined;

  const onError = (error: Error) => {
    console.warn('[updater] update check failed:', error.message);
  };
  const onUpdateDownloaded = (info: { version: string }) => {
    console.log(`[updater] version ${info.version} downloaded; installs on quit`);
  };
  autoUpdater.on('error', onError);
  autoUpdater.on('update-downloaded', onUpdateDownloaded);

  void autoUpdater.checkForUpdatesAndNotify();
  const interval = setInterval(() => void autoUpdater.checkForUpdatesAndNotify(), CHECK_INTERVAL_MS);

  return () => {
    clearInterval(interval);
    autoUpdater.removeListener('error', onError);
    autoUpdater.removeListener('update-downloaded', onUpdateDownloaded);
  };
};

/**
 * User-triggered check (menu action), separate from the silent background poll above.
 * Reuses the same autoUpdater singleton, so a found update still downloads in the
 * background and installs on quit via the 'update-downloaded' listener already registered.
 */
export const checkForAppUpdatesManually = async (): Promise<AppUpdateCheckResult> => {
  if (!app.isPackaged) return { status: 'unsupported' };
  if (process.platform !== 'darwin' && process.platform !== 'win32') return { status: 'unsupported' };

  try {
    const result = await autoUpdater.checkForUpdates();
    const latestVersion = result?.updateInfo?.version;
    if (!latestVersion || latestVersion === app.getVersion()) {
      return { status: 'current' };
    }
    return { status: 'updateAvailable', version: latestVersion };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
};
