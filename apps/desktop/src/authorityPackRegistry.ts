/**
 * Download and install pre-compiled authority packs from GitHub release assets.
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

import { writeFileAtomic } from './atomicWrite';

import { AUTHORITY_DB_DIRNAME } from './authorityDatabases';
import {
  AUTHORITY_PACK_REGISTRY,
  PACKS_MANIFEST_FILENAME,
  packsIndexUrl,
  parsePacksIndex,
  parsePacksManifest,
  tarballArtifactUrl,
  type AuthorityLifecycleProfile,
  type AuthorityPacksIndex,
  type AuthorityPacksIndexBundle,
  type AuthorityPacksManifest,
} from '../../commons/src/desktop/authorityPackRegistryTypes';

const execFileAsync = promisify(execFile);

/**
 * After a pack folder is replaced by a release/compile tree, copy back any
 * files that existed only in the previous live tree. Plugin-bundled assets
 * (e.g. `norbert/wiki-nt-links.ndjson`) share the same directory as release
 * packs and must not vanish when `norbert/` is swapped.
 *
 * Incoming files always win for shared paths.
 */
export async function restoreFilesAbsentFromSource(
  previousDir: string,
  nextDir: string,
): Promise<string[]> {
  const restored: string[] = [];
  if (!fs.existsSync(previousDir) || !fs.existsSync(nextDir)) return restored;

  const walk = async (relative = ''): Promise<void> => {
    const fromDir = relative ? path.join(previousDir, relative) : previousDir;
    const entries = await fsp.readdir(fromDir, { withFileTypes: true });
    for (const entry of entries) {
      const childRelative = relative ? path.join(relative, entry.name) : entry.name;
      const previousPath = path.join(previousDir, childRelative);
      const nextPath = path.join(nextDir, childRelative);
      if (entry.isDirectory()) {
        await walk(childRelative);
        continue;
      }
      if (fs.existsSync(nextPath)) continue;
      await fsp.mkdir(path.dirname(nextPath), { recursive: true });
      await fsp.copyFile(previousPath, nextPath);
      restored.push(childRelative.replace(/\\/g, '/'));
    }
  };

  await walk();
  return restored;
}
const MAX_PACK_DOWNLOAD_BYTES = 8 * 1024 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;

export {
  AUTHORITY_PACK_REGISTRY,
  PACKS_MANIFEST_FILENAME,
  packsIndexUrl,
  parsePacksIndex,
  parsePacksManifest,
  tarballArtifactUrl,
  type AuthorityLifecycleProfile,
  type AuthorityPacksIndex,
  type AuthorityPacksIndexBundle,
  type AuthorityPacksManifest,
} from '../../commons/src/desktop/authorityPackRegistryTypes';

export const packsManifestPath = (entityDbFolder: string): string =>
  path.join(entityDbFolder, AUTHORITY_DB_DIRNAME, PACKS_MANIFEST_FILENAME);

export const readInstalledPacksManifest = async (
  entityDbFolder: string | null,
): Promise<AuthorityPacksManifest | null> => {
  if (!entityDbFolder) return null;
  try {
    return parsePacksManifest(await fsp.readFile(packsManifestPath(entityDbFolder), 'utf-8'));
  } catch {
    return null;
  }
};

export const writeInstalledPacksManifest = async (
  entityDbFolder: string,
  manifest: AuthorityPacksManifest,
): Promise<void> => {
  const dir = path.join(entityDbFolder, AUTHORITY_DB_DIRNAME);
  await fsp.mkdir(dir, { recursive: true });
  const target = packsManifestPath(entityDbFolder);
  await writeFileAtomic(target, `${JSON.stringify(manifest, null, 2)}\n`);
};

const sha256File = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
};

const downloadToFile = async (
  url: string,
  destPath: string,
  onChunk?: (receivedBytes: number, totalBytes: number | null) => void,
  maxBytes = MAX_PACK_DOWNLOAD_BYTES,
): Promise<void> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} downloading ${url}`);
  }
  const contentLength = Number(response.headers.get('content-length'));
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null;
  if (totalBytes !== null && totalBytes > maxBytes) throw new Error(`Download exceeds the ${maxBytes} byte limit.`);

  let receivedBytes = 0;
  const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  await pipeline(
    body,
    async function* (chunks) {
      for await (const chunk of chunks) {
        receivedBytes += (chunk as Buffer).length;
        if (receivedBytes > maxBytes) throw new Error(`Download exceeds the ${maxBytes} byte limit.`);
        onChunk?.(receivedBytes, totalBytes);
        yield chunk;
      }
    },
    fs.createWriteStream(destPath),
  );
};

export const fetchRemotePacksIndex = async (
  registry = AUTHORITY_PACK_REGISTRY,
): Promise<AuthorityPacksIndex> => {
  const url = packsIndexUrl(registry);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch pack index (HTTP ${response.status}).`);
  }
  const raw = await response.text();
  const parsed = parsePacksIndex(raw);
  if (!parsed) {
    throw new Error('Pack index from GitHub is missing or malformed.');
  }
  return parsed;
};

export const bundleForProfile = (
  index: AuthorityPacksIndex,
  profile: AuthorityLifecycleProfile,
): AuthorityPacksIndexBundle => {
  const bundles = index.bundles ?? [];
  const match = bundles.find((bundle) => bundle.id === profile);
  if (!match) {
    throw new Error(`Pack index does not include a bundle for profile ${profile}.`);
  }
  return match;
};

export const remotePackUpdateAvailable = (
  local: AuthorityPacksManifest | null,
  remote: AuthorityPacksIndex,
  compilePolicyVersion: string,
  profile: AuthorityLifecycleProfile = 'chinese',
): boolean => {
  if (!local) return true;
  if (local.compilePolicyVersion !== remote.compilePolicyVersion) return true;
  if (local.compilePolicyVersion !== compilePolicyVersion) return true;
  // Per-bundle hashes are the authoritative signal: a bundleVersion bump without
  // a new tarball for this profile must not re-trigger downloads forever.
  const remoteBundle = bundleForProfile(remote, profile);
  return local.bundles[remoteBundle.id]?.sha256 !== remoteBundle.sha256;
};

export interface InstallPackBundleOptions {
  entityDbFolder: string;
  index: AuthorityPacksIndex;
  profile?: AuthorityLifecycleProfile;
  registry?: typeof AUTHORITY_PACK_REGISTRY;
  force?: boolean;
  onProgress?: (message: string, receivedBytes?: number, totalBytes?: number | null) => void;
}

/** Download tarball from GitHub, verify, extract to authority-packs/, write packs.manifest.json. */
export const installPackBundle = async ({
  entityDbFolder,
  index,
  profile = 'chinese',
  registry = AUTHORITY_PACK_REGISTRY,
  force = false,
  onProgress,
}: InstallPackBundleOptions): Promise<{ swapped: boolean }> => {
  const bundle = bundleForProfile(index, profile);
  const local = await readInstalledPacksManifest(entityDbFolder);
  if (!force && local && local.bundles[bundle.id]?.sha256 === bundle.sha256) {
    return { swapped: false };
  }

  const tarballUrl = tarballArtifactUrl(bundle.fileName, registry);
  const tempDir = path.join(entityDbFolder, '.authority-pack-install');
  const tarballPath = path.join(tempDir, bundle.fileName);
  const extractDir = path.join(tempDir, 'extract');

  await fsp.rm(tempDir, { recursive: true, force: true });
  await fsp.mkdir(tempDir, { recursive: true });

  onProgress?.(`Downloading ${bundle.fileName}…`, 0, bundle.bytes);
  await downloadToFile(tarballUrl, tarballPath, (received, total) => {
    onProgress?.(`Downloading authority packs…`, received, total ?? bundle.bytes);
  }, Math.min(MAX_PACK_DOWNLOAD_BYTES, bundle.bytes + 64 * 1024 * 1024));

  const tarballDigest = await sha256File(tarballPath);
  if (tarballDigest !== bundle.sha256) {
    throw new Error('Downloaded pack bundle failed checksum verification.');
  }

  onProgress?.('Extracting authority packs…');
  await fsp.mkdir(extractDir, { recursive: true });
  await execFileAsync('tar', ['-xzf', tarballPath, '-C', extractDir]);

  const extractedRoot = path.join(extractDir, 'authority-packs');
  if (!fs.existsSync(extractedRoot)) {
    throw new Error('Pack bundle did not contain an authority-packs/ folder.');
  }

  for (const fileSpec of bundle.files) {
    const filePath = path.join(extractedRoot, ...fileSpec.path.split('/'));
    if (!fs.existsSync(filePath)) {
      throw new Error(`Pack bundle missing ${fileSpec.path}`);
    }
    const digest = await sha256File(filePath);
    if (digest !== fileSpec.sha256) {
      throw new Error(`Checksum mismatch for ${fileSpec.path}`);
    }
  }

  // Merge per top-level entry rather than swapping the whole folder: profile
  // bundles are disjoint (cbdb/, ndl/, …) and must not clobber each other.
  // Within a source folder (e.g. norbert/), keep live-only files that the
  // tarball does not ship — typically plugin-bundled packs.
  const liveDir = path.join(entityDbFolder, 'authority-packs');
  await fsp.mkdir(liveDir, { recursive: true });
  for (const entry of await fsp.readdir(extractedRoot)) {
    const src = path.join(extractedRoot, entry);
    const dest = path.join(liveDir, entry);
    const bak = path.join(liveDir, `${entry}.bak`);
    const liveRoot = `${path.resolve(liveDir)}${path.sep}`;
    if (!path.resolve(dest).startsWith(liveRoot)) {
      throw new Error(`Pack bundle contains an unsafe top-level entry: ${entry}`);
    }
    await fsp.rm(bak, { recursive: true, force: true });
    if (fs.existsSync(dest)) {
      await fsp.rename(dest, bak);
    }
    try {
      await fsp.rename(src, dest);
      if (fs.existsSync(bak)) {
        await restoreFilesAbsentFromSource(bak, dest);
      }
    } catch (error) {
      if (fs.existsSync(bak) && !fs.existsSync(dest)) {
        await fsp.rename(bak, dest);
      }
      throw error;
    }
    await fsp.rm(bak, { recursive: true, force: true });
  }
  await fsp.rm(tempDir, { recursive: true, force: true });

  const installedAt = new Date().toISOString();
  await writeInstalledPacksManifest(entityDbFolder, {
    bundleVersion: index.bundleVersion,
    compilePolicyVersion: index.compilePolicyVersion,
    bundles: {
      ...(local?.bundles ?? {}),
      [bundle.id]: { sha256: bundle.sha256, installedAt },
    },
    installedAt,
  });

  // Queue developer purge-orders from this bundle into the local review docket.
  try {
    const { added } = await ingestPackPurgeOrdersFromInstall(entityDbFolder, liveDir);
    if (added > 0) {
      onProgress?.(`Queued ${added} developer pack review notice(s)…`);
    }
  } catch (error) {
    console.warn('Could not ingest pack purge orders', error);
  }

  return { swapped: true };
};

/**
 * Read `authority-packs/purge-orders/purge-orders.ndjson` (if present) and
 * append new developer orders into the local pack-purge docket.
 */
export async function ingestPackPurgeOrdersFromInstall(
  entityDbFolder: string,
  packsLiveDir: string = path.join(entityDbFolder, 'authority-packs'),
): Promise<{ added: number }> {
  const {
    mergeShippedOrdersIntoDocket,
    parseShippedPurgeOrders,
    packPurgeDocketPaths,
  } = await import(
    '../../../packages/cwrc-leafwriter/src/autoTagging/packPurgeDocket'
  );
  const candidates = [
    path.join(packsLiveDir, 'purge-orders', 'purge-orders.ndjson'),
    path.join(packsLiveDir, 'purge-orders.ndjson'),
  ];
  const shippedPath = candidates.find((p) => fs.existsSync(p));
  if (!shippedPath) return { added: 0 };

  const shipped = parseShippedPurgeOrders(await fsp.readFile(shippedPath, 'utf8'));
  if (!shipped.length) return { added: 0 };

  const paths = packPurgeDocketPaths(entityDbFolder);
  await fsp.mkdir(path.dirname(paths.orders), { recursive: true });
  let existing = '';
  try {
    existing = await fsp.readFile(paths.orders, 'utf8');
  } catch {
    // No docket on disk yet — the empty initializer stands.
  }
  const merged = mergeShippedOrdersIntoDocket(existing, shipped);
  if (merged.added > 0) {
    await writeFileAtomic(paths.orders, merged.text);
  }
  return { added: merged.added };
}
