import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/**
 * Auto-updates from GitHub releases (electron-updater reads the embedded
 * app-update.yml generated from the electron-builder `publish` config).
 * macOS updates via the zip target; the pkg is only the first install.
 */
export const initAutoUpdater = () => {
  if (!app.isPackaged) return;
  if (process.platform !== 'darwin' && process.platform !== 'win32') return;

  autoUpdater.on('error', (error) => {
    console.warn('[updater] update check failed:', error.message);
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[updater] version ${info.version} downloaded; installs on quit`);
  });

  void autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => void autoUpdater.checkForUpdatesAndNotify(), CHECK_INTERVAL_MS);
};
