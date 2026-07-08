/**
 * Download and install pre-compiled authority packs from GitLab CI (ljb-authorities).
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

import { AUTHORITY_DB_DIRNAME } from './authorityDatabases';
import {
  AUTHORITY_PACK_REGISTRY,
  PACKS_MANIFEST_FILENAME,
  packsIndexUrl,
  parsePacksIndex,
  parsePacksManifest,
  tarballArtifactUrl,
  type AuthorityPacksIndex,
  type AuthorityPacksManifest,
} from '../../commons/src/desktop/authorityPackRegistryTypes';

const execFileAsync = promisify(execFile);

export {
  AUTHORITY_PACK_REGISTRY,
  PACKS_MANIFEST_FILENAME,
  packsIndexUrl,
  parsePacksIndex,
  parsePacksManifest,
  tarballArtifactUrl,
  type AuthorityPacksIndex,
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
  const temp = `${target}.tmp`;
  await fsp.writeFile(temp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  await fsp.rename(temp, target);
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
): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} downloading ${url}`);
  }
  const contentLength = Number(response.headers.get('content-length'));
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null;

  let receivedBytes = 0;
  const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  await pipeline(
    body,
    async function* (chunks) {
      for await (const chunk of chunks) {
        receivedBytes += (chunk as Buffer).length;
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
    throw new Error('Pack index from GitLab is missing or malformed.');
  }
  return parsed;
};

export const remotePackUpdateAvailable = (
  local: AuthorityPacksManifest | null,
  remote: AuthorityPacksIndex,
  compilePolicyVersion: string,
): boolean => {
  if (!local) return true;
  if (local.bundleVersion !== remote.bundleVersion) return true;
  if (local.compilePolicyVersion !== remote.compilePolicyVersion) return true;
  if (local.compilePolicyVersion !== compilePolicyVersion) return true;
  return false;
};

export interface InstallPackBundleOptions {
  entityDbFolder: string;
  index: AuthorityPacksIndex;
  registry?: typeof AUTHORITY_PACK_REGISTRY;
  force?: boolean;
  onProgress?: (message: string, receivedBytes?: number, totalBytes?: number | null) => void;
}

/** Download tarball from GitLab, verify, extract to authority-packs/, write packs.manifest.json. */
export const installPackBundle = async ({
  entityDbFolder,
  index,
  registry = AUTHORITY_PACK_REGISTRY,
  force = false,
  onProgress,
}: InstallPackBundleOptions): Promise<{ swapped: boolean }> => {
  const local = await readInstalledPacksManifest(entityDbFolder);
  if (
    !force &&
    local &&
    local.bundleVersion === index.bundleVersion &&
    local.tarballSha256 === index.tarball.sha256
  ) {
    return { swapped: false };
  }

  const tarballUrl = tarballArtifactUrl(index.tarball.fileName, registry);
  const tempDir = path.join(entityDbFolder, '.authority-pack-install');
  const tarballPath = path.join(tempDir, index.tarball.fileName);
  const extractDir = path.join(tempDir, 'extract');

  await fsp.rm(tempDir, { recursive: true, force: true });
  await fsp.mkdir(tempDir, { recursive: true });

  onProgress?.(`Downloading ${index.tarball.fileName}…`, 0, index.tarball.bytes);
  await downloadToFile(tarballUrl, tarballPath, (received, total) => {
    onProgress?.(`Downloading authority packs…`, received, total ?? index.tarball.bytes);
  });

  const tarballDigest = await sha256File(tarballPath);
  if (tarballDigest !== index.tarball.sha256) {
    throw new Error('Downloaded pack bundle failed checksum verification.');
  }

  onProgress?.('Extracting authority packs…');
  await fsp.mkdir(extractDir, { recursive: true });
  await execFileAsync('tar', ['-xzf', tarballPath, '-C', extractDir]);

  const extractedRoot = path.join(extractDir, 'authority-packs');
  if (!fs.existsSync(extractedRoot)) {
    throw new Error('Pack bundle did not contain an authority-packs/ folder.');
  }

  for (const fileSpec of index.files) {
    const filePath = path.join(extractedRoot, ...fileSpec.path.split('/'));
    if (!fs.existsSync(filePath)) {
      throw new Error(`Pack bundle missing ${fileSpec.path}`);
    }
    const digest = await sha256File(filePath);
    if (digest !== fileSpec.sha256) {
      throw new Error(`Checksum mismatch for ${fileSpec.path}`);
    }
  }

  const liveDir = path.join(entityDbFolder, 'authority-packs');
  const bakDir = path.join(entityDbFolder, 'authority-packs.bak');
  await fsp.rm(bakDir, { recursive: true, force: true });
  if (fs.existsSync(liveDir)) {
    await fsp.rename(liveDir, bakDir);
  }
  try {
    await fsp.rename(extractedRoot, liveDir);
  } catch (error) {
    if (fs.existsSync(bakDir) && !fs.existsSync(liveDir)) {
      await fsp.rename(bakDir, liveDir);
    }
    throw error;
  }
  await fsp.rm(bakDir, { recursive: true, force: true });
  await fsp.rm(tempDir, { recursive: true, force: true });

  await writeInstalledPacksManifest(entityDbFolder, {
    bundleVersion: index.bundleVersion,
    compilePolicyVersion: index.compilePolicyVersion,
    tarballSha256: index.tarball.sha256,
    installedAt: new Date().toISOString(),
  });

  return { swapped: true };
};
