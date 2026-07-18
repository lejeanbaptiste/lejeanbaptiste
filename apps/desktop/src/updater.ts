import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

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
