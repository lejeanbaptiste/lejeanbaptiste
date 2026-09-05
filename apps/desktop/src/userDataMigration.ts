/**
 * One-time import of a user's data from the pre-rename app ("Le Jean-Baptiste").
 *
 * The rename changed Electron's app name, which moves `app.getPath('userData')`
 * from `<appData>/Le Jean-Baptiste` to `<appData>/Grognard`. Without this, a
 * user who updates in place would find an empty profile: no prefs, no entity
 * databases, no installed plugins, no achievements.
 *
 * On first launch under the new name we copy the legacy profile across. It is a
 * COPY, not a move — the old directory is left intact so an old build still
 * runs and the user can roll back. Regenerable caches are skipped to keep the
 * copy small and fast; the app rebuilds them on demand.
 *
 * Must be called immediately after `app.setName(APP_NAME)` and before anything
 * reads a userData path. Never throws — a failed migration must not block
 * startup.
 */
import { app } from 'electron';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Electron's `app.getName()` before the Grognard rename. */
const LEGACY_APP_NAME = 'Le Jean-Baptiste';

/** Written into the new userData dir once migration has been attempted. */
const MARKER_FILENAME = '.migrated-from-lejeanbaptiste.json';

/**
 * Top-level entries under userData that the app recreates by itself. Skipping
 * them avoids copying gigabytes of corpus clones and Chromium scratch space.
 */
const SKIP_TOP_LEVEL = new Set([
  // Grognard-managed caches (re-cloned / re-downloaded on demand)
  'kanripo-cache',
  'daozang-cache',
  'plugin-cache',
  'ljb-java',
  'grognard-java',
  'native-host',
  // Chromium / Electron scratch
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnWebGPUCache',
  'ShaderCache',
  'Crashpad',
  'blob_storage',
  'logs',
]);

const marker = (dir: string) => path.join(dir, MARKER_FILENAME);

const legacyUserDataDir = (): string => path.join(app.getPath('appData'), LEGACY_APP_NAME);

/** True when `dir` holds nothing but Chromium-created scratch (i.e. no real app data yet). */
const isEffectivelyEmpty = (dir: string): boolean => {
  try {
    return readdirSync(dir).every((name) => SKIP_TOP_LEVEL.has(name) || name === MARKER_FILENAME);
  } catch {
    return true;
  }
};

export const migrateLegacyUserData = (): void => {
  const currentDir = app.getPath('userData');

  try {
    if (existsSync(marker(currentDir))) return; // already handled

    const legacyDir = legacyUserDataDir();
    if (legacyDir === currentDir || !existsSync(legacyDir) || !statSync(legacyDir).isDirectory()) {
      recordMarker(currentDir, { ok: true, migrated: false, reason: 'no legacy profile' });
      return;
    }

    if (existsSync(currentDir) && !isEffectivelyEmpty(currentDir)) {
      // The user already has data under the new name — don't overwrite it.
      recordMarker(currentDir, { ok: true, migrated: false, reason: 'new profile already populated' });
      return;
    }

    mkdirSync(currentDir, { recursive: true });

    const skipped: string[] = [];
    cpSync(legacyDir, currentDir, {
      recursive: true,
      force: false,
      errorOnExist: false,
      filter: (src) => {
        const rel = path.relative(legacyDir, src);
        if (!rel) return true;
        const top = rel.split(path.sep)[0];
        if (SKIP_TOP_LEVEL.has(top)) {
          if (rel === top) skipped.push(top);
          return false;
        }
        return true;
      },
    });

    recordMarker(currentDir, {
      ok: true,
      migrated: true,
      from: legacyDir,
      at: new Date().toISOString(),
      skipped,
    });
    console.log(`[userDataMigration] imported profile from ${legacyDir} (skipped: ${skipped.join(', ') || 'none'})`);
  } catch (error) {
    // Record the failure so we don't retry a partial copy on every launch.
    recordMarker(currentDir, {
      ok: false,
      migrated: false,
      at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('[userDataMigration] failed to import legacy profile:', error);
  }
};

function recordMarker(dir: string, payload: Record<string, unknown>): void {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(marker(dir), JSON.stringify(payload, null, 2));
  } catch {
    // best-effort only
  }
}
