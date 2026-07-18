/**
 * Authority-database download manager (auto-tagging Phase A1).
 *
 * CBDB and DILA are fetched on demand into `<entityDbFolder>/authority-databases/`
 * (alongside the user's central entity database). Each installed source gets a
 * `<id>.manifest.json`; a source counts as available only when its manifest
 * parses and every listed file is present with the recorded size. Nothing else
 * in the app reads the raw files — later phases consume compiled artifacts.
 *
 * Electron-free: callers inject the base directory (main.ts composes with
 * getEntityDbFolder), so the pure parts are unit-testable.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import JSZip from 'jszip';

const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 20_000;
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;

import type {
  AuthorityDownloadProgress,
  AuthoritySourceId,
  AuthoritySourceStatus,
} from '../../commons/src/desktop/authorityDbTypes';

export type {
  AuthorityDownloadProgress,
  AuthoritySourceId,
  AuthoritySourceStatus,
} from '../../commons/src/desktop/authorityDbTypes';

export const AUTHORITY_DB_DIRNAME = 'authority-databases';

interface AuthorityFileSpec {
  url: string;
  /** Final file name inside the authority-databases directory. */
  fileName: string;
  /** Expected sha256 of the *stored* file, when upstream publishes one. */
  sha256?: string;
  /** If set, the download is a zip: extract the single entry ending with this suffix. */
  unzipEntrySuffix?: string;
}

export interface AuthoritySourceSpec {
  id: AuthoritySourceId;
  label: string;
  /** Human-readable upstream version, recorded in the manifest. */
  version: string;
  files: AuthorityFileSpec[];
}

/** Pinned DILA commit (2026-06-30); bumped by the update check in Phase A5. */
export const DILA_PINNED_COMMIT = '385e3f557285d7a60346f85d698193e19b6cea2f';

const dilaRawUrl = (repoPath: string) =>
  `https://raw.githubusercontent.com/DILA-edu/Authority-Databases/${DILA_PINNED_COMMIT}/${repoPath}`;

export const AUTHORITY_SOURCES: AuthoritySourceSpec[] = [
  {
    id: 'cbdb',
    label: 'CBDB — China Biographical Database',
    version: '20260627',
    files: [
      {
        url: 'https://huggingface.co/datasets/cbdb/cbdb-sqlite/resolve/main/history/cbdb_202606/cbdb_20260627.zip',
        fileName: 'cbdb.sqlite3',
        // sha256 of the extracted sqlite, from the dataset's release manifest.
        sha256: '193d6fc3f979524abb678728ad1139472638b17aedaa695fa2f331b0a3086496',
        unzipEntrySuffix: '.sqlite3',
      },
    ],
  },
  {
    id: 'dila',
    label: 'DILA — Buddhist Studies Person & Place Authorities',
    version: `${DILA_PINNED_COMMIT.slice(0, 12)} (2026-06-30)`,
    files: [
      {
        url: dilaRawUrl('authority_person/Buddhist_Studies_Person_Authority.xml'),
        fileName: 'dila-person.xml',
      },
      {
        url: dilaRawUrl('authority_place/Buddhist_Studies_Place_Authority.xml'),
        fileName: 'dila-place.xml',
      },
      {
        url: dilaRawUrl('authority_place/districts.xml'),
        fileName: 'dila-districts.xml',
      },
    ],
  },
];

export interface AuthorityManifestFile {
  fileName: string;
  sha256: string;
  bytes: number;
  upstreamUrl: string;
}

export interface AuthorityManifest {
  source: AuthoritySourceId;
  version: string;
  files: AuthorityManifestFile[];
  installedAt: string;
}

export const manifestPath = (baseDir: string, id: AuthoritySourceId): string =>
  path.join(baseDir, `${id}.manifest.json`);

export const parseAuthorityManifest = (raw: string): AuthorityManifest | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<AuthorityManifest>;
    if (parsed.source !== 'cbdb' && parsed.source !== 'dila') return null;
    if (typeof parsed.version !== 'string' || !parsed.version) return null;
    if (typeof parsed.installedAt !== 'string') return null;
    if (!Array.isArray(parsed.files) || parsed.files.length === 0) return null;
    for (const file of parsed.files) {
      if (typeof file?.fileName !== 'string' || !file.fileName) return null;
      if (typeof file?.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256)) return null;
      if (typeof file?.bytes !== 'number' || file.bytes <= 0) return null;
      if (typeof file?.upstreamUrl !== 'string') return null;
    }
    return parsed as AuthorityManifest;
  } catch {
    return null;
  }
};

const readManifest = async (
  baseDir: string,
  id: AuthoritySourceId,
): Promise<AuthorityManifest | null> => {
  try {
    return parseAuthorityManifest(await fsp.readFile(manifestPath(baseDir, id), 'utf-8'));
  } catch {
    return null;
  }
};

/** Manifest parses and every listed file exists with the recorded size. */
const manifestFilesPresent = async (
  baseDir: string,
  manifest: AuthorityManifest,
): Promise<boolean> => {
  for (const file of manifest.files) {
    try {
      const stat = await fsp.stat(path.join(baseDir, file.fileName));
      if (stat.size !== file.bytes) return false;
    } catch {
      return false;
    }
  }
  return true;
};

export const getAuthorityStatuses = async (
  baseDir: string | null,
): Promise<AuthoritySourceStatus[]> => {
  const statuses: AuthoritySourceStatus[] = [];
  for (const spec of AUTHORITY_SOURCES) {
    let manifest: AuthorityManifest | null = null;
    if (baseDir) {
      manifest = await readManifest(baseDir, spec.id);
      if (manifest && !(await manifestFilesPresent(baseDir, manifest))) manifest = null;
    }
    statuses.push({
      id: spec.id,
      label: spec.label,
      installed: manifest !== null,
      version: manifest?.version,
      installedAt: manifest?.installedAt,
    });
  }
  return statuses;
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
  onChunk: (receivedBytes: number, totalBytes: number | null) => void,
  maxBytes = MAX_DOWNLOAD_BYTES,
): Promise<void> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} for ${url}`);
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
        onChunk(receivedBytes, totalBytes);
        yield chunk;
      }
    },
    fs.createWriteStream(destPath),
  );
};

const extractZipEntry = async (
  zipPath: string,
  entrySuffix: string,
  destPath: string,
  onProgress: (receivedBytes: number) => void,
): Promise<void> => {
  const archiveStat = await fsp.stat(zipPath);
  if (archiveStat.size > MAX_ARCHIVE_BYTES) throw new Error('Authority archive is too large.');
  const zip = await JSZip.loadAsync(await fsp.readFile(zipPath));
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error('Authority archive has too many entries.');
  const entry = entries.find(
    (file) => !file.dir && file.name.endsWith(entrySuffix),
  );
  if (!entry) throw new Error(`No ${entrySuffix} entry in ${path.basename(zipPath)}`);
  const declaredSize = (entry as unknown as { _data?: { uncompressedSize?: number } })._data
    ?.uncompressedSize;
  if (declaredSize !== undefined && declaredSize > MAX_ENTRY_BYTES) {
    throw new Error('Authority archive entry is too large.');
  }

  let receivedBytes = 0;
  const sizeGuard = new Transform({
    transform(chunk, _encoding, callback) {
      receivedBytes += (chunk as Buffer).length;
      if (receivedBytes > MAX_ENTRY_BYTES) {
        callback(new Error('Authority archive entry expands beyond the supported size limit.'));
        return;
      }
      onProgress(receivedBytes);
      callback(null, chunk);
    },
  });
  await pipeline(
    entry.nodeStream(),
    sizeGuard,
    fs.createWriteStream(destPath),
  );
};

/**
 * Download and install one source. Files land under temp names and are renamed
 * into place only after checksum verification; the manifest is written last,
 * so a crashed or failed download never yields an "installed" source.
 */
export const downloadAuthoritySource = async (
  baseDir: string,
  id: AuthoritySourceId,
  onProgress?: (progress: AuthorityDownloadProgress) => void,
): Promise<AuthorityManifest> => {
  const spec = AUTHORITY_SOURCES.find((source) => source.id === id);
  if (!spec) throw new Error(`Unknown authority source: ${id}`);

  await fsp.mkdir(baseDir, { recursive: true });

  const installedFiles: AuthorityManifestFile[] = [];
  const tempPaths: string[] = [];

  try {
    for (const file of spec.files) {
      const tempPath = path.join(baseDir, `${file.fileName}.download`);
      tempPaths.push(tempPath);

      if (file.unzipEntrySuffix) {
        const zipTempPath = `${tempPath}.zip`;
        tempPaths.push(zipTempPath);
        await downloadToFile(file.url, zipTempPath, (receivedBytes, totalBytes) =>
          onProgress?.({
            sourceId: id,
            fileName: file.fileName,
            phase: 'downloading',
            receivedBytes,
            totalBytes,
          }),
          MAX_DOWNLOAD_BYTES,
        );
        await extractZipEntry(zipTempPath, file.unzipEntrySuffix, tempPath, (receivedBytes) =>
          onProgress?.({
            sourceId: id,
            fileName: file.fileName,
            phase: 'extracting',
            receivedBytes,
            totalBytes: null,
          }),
        );
        await fsp.rm(zipTempPath, { force: true });
      } else {
        await downloadToFile(file.url, tempPath, (receivedBytes, totalBytes) =>
          onProgress?.({
            sourceId: id,
            fileName: file.fileName,
            phase: 'downloading',
            receivedBytes,
            totalBytes,
          }),
          MAX_DOWNLOAD_BYTES,
        );
      }

      const digest = await sha256File(tempPath);
      if (file.sha256 && digest !== file.sha256) {
        throw new Error(`Checksum mismatch for ${file.fileName}`);
      }
      const stat = await fsp.stat(tempPath);
      installedFiles.push({
        fileName: file.fileName,
        sha256: digest,
        bytes: stat.size,
        upstreamUrl: file.url,
      });
    }

    // All files verified: move into place, then write the manifest.
    for (const file of spec.files) {
      await fsp.rename(path.join(baseDir, `${file.fileName}.download`), path.join(baseDir, file.fileName));
    }
    const manifest: AuthorityManifest = {
      source: id,
      version: spec.version,
      files: installedFiles,
      installedAt: new Date().toISOString(),
    };
    await fsp.writeFile(manifestPath(baseDir, id), JSON.stringify(manifest, null, 2), 'utf-8');
    return manifest;
  } catch (error) {
    for (const tempPath of tempPaths) {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined);
    }
    throw error;
  }
};
