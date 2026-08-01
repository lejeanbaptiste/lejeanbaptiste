import { Notification, app } from 'electron';
import { autoUpdater } from 'electron-updater';

import type { AppUpdateCheckResult } from '../../commons/src/desktop/appUpdateTypes';
import { maybeCheckAuthorityUpdates } from './authorityLifecycle';
import { getLocalAuthorityAssetsDir } from './projectPrefs';
import { getPluginHostSnapshot } from './plugins/pluginHost';
import { fetchRemotePluginIndex } from './plugins/pluginRegistry';

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

export type InitAutoUpdaterOptions = {
  /** Invoked when the user clicks a companion-update (packs/plugins) notification. */
  onCompanionNotifyClick?: () => void;
};

let lastAuthorityNotifyKey = '';
let lastPluginNotifyKey = '';

const countPluginUpdates = async (): Promise<{ count: number; key: string }> => {
  const [installed, remote] = await Promise.all([
    getPluginHostSnapshot(),
    fetchRemotePluginIndex(),
  ]);
  const installedVersionById = new Map(
    installed.plugins.map((plugin) => [plugin.id, plugin.version]),
  );
  const outdated = remote.plugins.filter((entry) => {
    const installedVersion = installedVersionById.get(entry.id);
    return installedVersion === undefined || installedVersion !== entry.version;
  });
  const key = outdated
    .map((entry) => `${entry.id}@${entry.version}`)
    .sort()
    .join(',');
  return { count: outdated.length, key };
};

/**
 * Background check for authority packs + plugins (same cadence as the app updater).
 * Notifies once per distinct available update set; silent on network errors.
 */
export const checkCompanionUpdatesInBackground = async (
  options?: InitAutoUpdaterOptions,
): Promise<void> => {
  try {
    const folder = await getLocalAuthorityAssetsDir();
    const status = await maybeCheckAuthorityUpdates(folder, { force: true });
    if (status?.enabled && status.updateAvailable) {
      const key =
        status.packBundleVersion ??
        status.rawSources.map((source) => `${source.id}:${source.version ?? ''}`).join('|') ??
        'authority-update';
      if (key !== lastAuthorityNotifyKey) {
        lastAuthorityNotifyKey = key;
        const notification = new Notification({
          title: 'Authority pack updates available',
          body: 'New tagging / reference data is ready. Choose Look for Updates to install.',
        });
        if (options?.onCompanionNotifyClick) {
          notification.on('click', () => options.onCompanionNotifyClick?.());
        }
        notification.show();
      }
    }
  } catch (error) {
    console.warn(
      '[updater] authority pack check failed:',
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    const { count, key } = await countPluginUpdates();
    if (count > 0 && key !== lastPluginNotifyKey) {
      lastPluginNotifyKey = key;
      const notification = new Notification({
        title: 'Plugin updates available',
        body:
          count === 1
            ? '1 plugin update is available. Choose Look for Updates or open Plugins.'
            : `${count} plugin updates are available. Choose Look for Updates or open Plugins.`,
      });
      if (options?.onCompanionNotifyClick) {
        notification.on('click', () => options.onCompanionNotifyClick?.());
      }
      notification.show();
    }
  } catch (error) {
    console.warn(
      '[updater] plugin update check failed:',
      error instanceof Error ? error.message : String(error),
    );
  }
};

const runScheduledChecks = (options?: InitAutoUpdaterOptions): void => {
  if (app.isPackaged && (process.platform === 'darwin' || process.platform === 'win32')) {
    void autoUpdater.checkForUpdatesAndNotify();
  }
  void checkCompanionUpdatesInBackground(options);
};

export const initAutoUpdater = (options?: InitAutoUpdaterOptions): (() => void) => {
  const supportsAppBinaryUpdates =
    app.isPackaged && (process.platform === 'darwin' || process.platform === 'win32');

  if (supportsAppBinaryUpdates) {
    configureAutoUpdater();
    const onError = (error: Error) => {
      console.warn('[updater] update check failed:', error.message);
    };
    const onUpdateDownloaded = (info: { version: string }) => {
      console.log(`[updater] version ${info.version} downloaded; installs on quit`);
    };
    autoUpdater.on('error', onError);
    autoUpdater.on('update-downloaded', onUpdateDownloaded);

    runScheduledChecks(options);
    const interval = setInterval(() => runScheduledChecks(options), CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      autoUpdater.removeListener('error', onError);
      autoUpdater.removeListener('update-downloaded', onUpdateDownloaded);
    };
  }

  // Dev / Linux: still poll packs + plugins on the same cadence.
  runScheduledChecks(options);
  const interval = setInterval(() => runScheduledChecks(options), CHECK_INTERVAL_MS);
  return () => clearInterval(interval);
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

/** @internal test helper */
export const _resetCompanionNotifyStateForTests = (): void => {
  lastAuthorityNotifyKey = '';
  lastPluginNotifyKey = '';
};
