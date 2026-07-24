import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

import type { AppUpdateCheckResult } from '../../commons/src/desktop/appUpdateTypes';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/**
 * Auto-updates from GitHub releases (electron-updater reads the embedded
 * app-update.yml generated from the electron-builder `publish` config).
 * macOS updates via the zip target; the pkg is only the first install.
 *
 * We force allowPrerelease=false so the updater uses GitHub's /releases/latest
 * (the release marked Latest). If we leave the default (true whenever the
 * installed build itself is a prerelease), electron-updater treats the first
 * prerelease identifier as a "channel": `0.0.2-rc9` only accepts other `rc9`
 * tags, and skips `0.0.3-rc.11` (channel `rc`). That made Look for updates
 * report "up to date" forever across our dotted vs undotted RC tags.
 */
const configureAutoUpdater = (): void => {
  autoUpdater.allowPrerelease = false;
};

export const initAutoUpdater = (): (() => void) => {
  if (!app.isPackaged) return () => undefined;
  if (process.platform !== 'darwin' && process.platform !== 'win32') return () => undefined;

  configureAutoUpdater();

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

  configureAutoUpdater();

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.isUpdateAvailable) {
      return { status: 'current' };
    }
    return { status: 'updateAvailable', version: result.updateInfo.version };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
};
