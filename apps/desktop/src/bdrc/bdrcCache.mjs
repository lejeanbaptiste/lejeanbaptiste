/**
 * On-disk cache for assembled BDRC etext volumes (docs §7).
 *
 * Key = `<UT id>__<contentsGitRevision>.json`. A volume re-imports from cache
 * until BDRC re-syncs it (the revision changes) or the user forces a refresh.
 * Pure convenience — the caller `.gitignore`s the directory and it is safe to
 * delete. No revision (older / unsynced etexts) ⇒ never cached.
 *
 * File I/O is sync and best-effort: a cache miss, a corrupt entry, or an
 * unwritable directory all degrade silently to a live fetch.
 */

import fs from 'node:fs';
import path from 'node:path';

const bare = (utId) =>
  String(utId ?? '')
    .replace(/^bdr:/, '')
    .replace(/^https?:\/\/purl\.bdrc\.io\/resource\//, '');

export function cacheKey(utId, revision) {
  return `${bare(utId)}__${revision}.json`;
}

/** @returns {object | null} the cached import result, or null on any miss. */
export function readCache(dir, utId, revision) {
  if (!dir || !revision) return null;
  try {
    const file = path.join(dir, cacheKey(utId, revision));
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeCache(dir, utId, revision, payload) {
  if (!dir || !revision) return;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, cacheKey(utId, revision)), JSON.stringify(payload));
  } catch {
    // best-effort
  }
}

/** Drop every cached revision of one volume (used by "Refresh"). */
export function clearCache(dir, utId) {
  const prefix = `${bare(utId)}__`;
  try {
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(prefix)) fs.unlinkSync(path.join(dir, name));
    }
  } catch {
    // nothing to clear
  }
}
