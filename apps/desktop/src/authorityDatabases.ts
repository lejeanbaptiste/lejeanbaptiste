/**
 * Authority-database download manager (reference tier / A1 + A6).
 *
 * Two tiers of authority data:
 *   1. Tagging packs — NDJSON bundles from the authoritypacks GitHub release
 *      (handled elsewhere).
 *   2. Reference databases — optional full records for disambiguation enrichment
 *      via authorityRef:lookup.
 *
 * Reference sources installed here:
 *   - CBDB + Norbert person sqlite — downloaded together as a slim zip from the
 *     same GitHub release channel (`reference-index.json`), not the full
 *     HuggingFace CBDB dump.
 *   - DILA TEI — human browse/download page is Open Content
 *     (DILA_OPEN_CONTENT_DOWNLOAD_PAGE); the machine mirror used here is the
 *     pinned GitHub commit of DILA-edu/Authority-Databases.
 *
 * Files land in `<entityDbFolder>/authority-databases/`. Each source gets an
 * `<id>.manifest.json`; a source counts as available only when its manifest
 * parses and every listed file is present with the recorded size.
 *
 * Electron-free: callers inject the base directory (main.ts composes with the
 * local authority-assets folder), so the pure parts are unit-testable.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import JSZip from 'jszip';

import { resolveAuthorityExtractionRoot, runNodeScript } from './nodeScriptRunner';
import { AUTHORITY_PACK_REGISTRY } from '../../commons/src/desktop/authorityPackRegistryTypes';
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

const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 20_000;
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const FETCH_USER_AGENT = 'Grognard-authority/1.0';

/** Norbert reduced-authority export pin (CBDB is fetched independently — see below). */
const NORBERT_REFERENCE_VERSION = '2026-07-25-reduced-authority';

/**
 * CBDB's own official release (HuggingFace), fetched directly rather than
 * through a copy we repackage and redistribute via our own GitHub release.
 * Keep this pin in sync with `authority extraction/upstream/pins.json`'s
 * `cbdb` entry when CBDB publishes a new version — that repo's
 * `fetch-upstream.mjs` pulls from the same URL for the build pipeline.
 */
const CBDB_OFFICIAL_VERSION = '20260627';
const CBDB_OFFICIAL_ZIP_URL =
  'https://huggingface.co/datasets/cbdb/cbdb-sqlite/resolve/main/history/cbdb_202606/cbdb_20260627.zip';
const CBDB_OFFICIAL_SQLITE_SHA256 =
  '193d6fc3f979524abb678728ad1139472638b17aedaa695fa2f331b0a3086496';

export const AUTHORITY_DB_DIRNAME = 'authority-databases';

/** Human-facing DILA Open Content download page (browse / manual download). */
export const DILA_OPEN_CONTENT_DOWNLOAD_PAGE =
  'https://authority.dila.edu.tw/docs/open_content/download.php';

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
    label: 'CBDB — China Biographical Database (person + office reference)',
    version: CBDB_OFFICIAL_VERSION,
    // Installed via downloadCbdbDirect, not per-file URLs.
    files: [],
  },
  {
    id: 'norbert',
    label: 'Norbert — person & office authority (reference)',
    version: NORBERT_REFERENCE_VERSION,
    // Installed via downloadNorbertReferenceBundle, not per-file URLs.
    files: [],
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

export interface ReferencePersonIndex {
  version: string;
  artifact: string;
  sha256: string;
  bytes: number;
  manifest?: {
    files?: Record<string, { sha256?: string; bytes?: number; sourceVersion?: string }>;
  };
}

export const manifestPath = (baseDir: string, id: AuthoritySourceId): string =>
  path.join(baseDir, `${id}.manifest.json`);

export const referenceIndexUrl = (): string =>
  `${AUTHORITY_PACK_REGISTRY.releaseDownloadBaseUrl}/reference-index.json`;

export const parseAuthorityManifest = (raw: string): AuthorityManifest | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<AuthorityManifest>;
    if (parsed.source !== 'cbdb' && parsed.source !== 'dila' && parsed.source !== 'norbert') {
      return null;
    }
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

const parseReferencePersonIndex = (raw: string): ReferencePersonIndex | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<ReferencePersonIndex>;
    if (typeof parsed.version !== 'string' || !parsed.version) return null;
    if (typeof parsed.artifact !== 'string' || !parsed.artifact) return null;
    if (typeof parsed.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(parsed.sha256)) return null;
    if (typeof parsed.bytes !== 'number' || parsed.bytes <= 0) return null;
    return parsed as ReferencePersonIndex;
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
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: { 'User-Agent': FETCH_USER_AGENT },
  });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const contentLength = Number(response.headers.get('content-length'));
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null;
  if (totalBytes !== null && totalBytes > maxBytes)
    throw new Error(`Download exceeds the ${maxBytes} byte limit.`);

  let receivedBytes = 0;
  const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  await pipeline(
    body,
    async function* (chunks) {
      for await (const chunk of chunks) {
        receivedBytes += (chunk as Buffer).length;
        if (receivedBytes > maxBytes)
          throw new Error(`Download exceeds the ${maxBytes} byte limit.`);
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
  if (entries.length > MAX_ARCHIVE_ENTRIES)
    throw new Error('Authority archive has too many entries.');
  const entry = entries.find((file) => !file.dir && file.name.endsWith(entrySuffix));
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
  await pipeline(entry.nodeStream(), sizeGuard, fs.createWriteStream(destPath));
};

const writeSourceManifest = async (baseDir: string, manifest: AuthorityManifest): Promise<void> => {
  await fsp.writeFile(
    manifestPath(baseDir, manifest.source),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );
};

/**
 * Fetch reference-index.json, download the person-reference zip, verify
 * sha256, extract norbert.sqlite3, and write its manifest. CBDB used to be
 * bundled into this same zip; it now downloads independently (see
 * downloadCbdbDirect below) so this app is never the one redistributing a
 * repackaged copy of CBDB's own data. Norbert has no equivalent concern —
 * its license ("internal-derived-public", see authority extraction's
 * upstream/pins.json) is our own reduced-authority export, not a third
 * party's copyrighted compilation.
 */
export const downloadNorbertReferenceBundle = async (
  baseDir: string,
  onProgress?: (progress: AuthorityDownloadProgress) => void,
): Promise<AuthorityManifest> => {
  await fsp.mkdir(baseDir, { recursive: true });

  const indexUrl = referenceIndexUrl();
  const indexResponse = await fetch(indexUrl, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: { 'User-Agent': FETCH_USER_AGENT },
  });
  if (!indexResponse.ok) {
    throw new Error(`HTTP ${indexResponse.status} fetching reference index`);
  }
  const index = parseReferencePersonIndex(await indexResponse.text());
  if (!index) throw new Error('Reference person index is missing or malformed.');

  const artifactUrl = `${AUTHORITY_PACK_REGISTRY.releaseDownloadBaseUrl}/${index.artifact}`;
  const zipTempPath = path.join(baseDir, `${index.artifact}.download`);
  const norbertTemp = path.join(baseDir, 'norbert.sqlite3.download');
  const tempPaths = [zipTempPath, norbertTemp];

  try {
    await downloadToFile(artifactUrl, zipTempPath, (receivedBytes, totalBytes) =>
      onProgress?.({
        sourceId: 'norbert',
        fileName: index.artifact,
        phase: 'downloading',
        receivedBytes,
        totalBytes,
      }),
    );

    const zipDigest = await sha256File(zipTempPath);
    if (zipDigest !== index.sha256) {
      throw new Error(`Checksum mismatch for ${index.artifact}`);
    }

    await extractZipEntry(zipTempPath, 'norbert.sqlite3', norbertTemp, (receivedBytes) =>
      onProgress?.({
        sourceId: 'norbert',
        fileName: 'norbert.sqlite3',
        phase: 'extracting',
        receivedBytes,
        totalBytes: null,
      }),
    );

    const norbertDigest = await sha256File(norbertTemp);
    const expectedNorbert = index.manifest?.files?.['norbert.sqlite3']?.sha256;
    if (expectedNorbert && norbertDigest !== expectedNorbert) {
      throw new Error('Checksum mismatch for norbert.sqlite3');
    }

    const norbertStat = await fsp.stat(norbertTemp);
    await fsp.rename(norbertTemp, path.join(baseDir, 'norbert.sqlite3'));
    await fsp.rm(zipTempPath, { force: true });

    const manifest: AuthorityManifest = {
      source: 'norbert',
      version: index.version,
      files: [
        {
          fileName: 'norbert.sqlite3',
          sha256: norbertDigest,
          bytes: norbertStat.size,
          upstreamUrl: artifactUrl,
        },
      ],
      installedAt: new Date().toISOString(),
    };
    await writeSourceManifest(baseDir, manifest);
    return manifest;
  } catch (error) {
    for (const tempPath of tempPaths) {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined);
    }
    throw error;
  }
};

/**
 * Fetch CBDB's own official release directly (HuggingFace, pinned above —
 * the same source authority extraction's build pipeline uses) and strip it
 * locally to a person+office reference subset via the bundled
 * authority-extraction CLI (cbdb/stripReferenceDb.mjs — the exact script the
 * build pipeline itself runs; not a reimplementation). This app never holds
 * or redistributes its own repackaged copy of CBDB's data: each install
 * downloads and processes CBDB's own release on its own machine.
 *
 * CBDB's upstream OFFICE_CODES table embeds some office-title glosses that
 * CBDB itself cites as "(Hucker)" — see leaf-writer/docs/huckbot5000-planning.md.
 * Publishable *tagging* packs omit those fields before redistribution
 * (authority extraction/cbdb/compileRecords.mjs). This reference sqlite is a
 * table-subset of CBDB's official release as installed for the user: office
 * translations are left intact so Grognard can display what CBDB publishes. Nothing
 * here is re-packaged into our GitHub pack assets.
 */
export const downloadCbdbDirect = async (
  baseDir: string,
  onProgress?: (progress: AuthorityDownloadProgress) => void,
): Promise<AuthorityManifest> => {
  await fsp.mkdir(baseDir, { recursive: true });

  const zipTempPath = path.join(baseDir, 'cbdb-official.zip.download');
  const fullSqliteTempPath = path.join(baseDir, 'cbdb-official.sqlite3.download');
  const strippedTempPath = path.join(baseDir, 'cbdb-person.sqlite3.download');
  const tempPaths = [zipTempPath, fullSqliteTempPath, strippedTempPath];

  try {
    await downloadToFile(CBDB_OFFICIAL_ZIP_URL, zipTempPath, (receivedBytes, totalBytes) =>
      onProgress?.({
        sourceId: 'cbdb',
        fileName: `cbdb_${CBDB_OFFICIAL_VERSION}.zip`,
        phase: 'downloading',
        receivedBytes,
        totalBytes,
      }),
    );

    await extractZipEntry(zipTempPath, '.sqlite3', fullSqliteTempPath, (receivedBytes) =>
      onProgress?.({
        sourceId: 'cbdb',
        fileName: 'cbdb.sqlite3',
        phase: 'extracting',
        receivedBytes,
        totalBytes: null,
      }),
    );
    await fsp.rm(zipTempPath, { force: true });

    const fullDigest = await sha256File(fullSqliteTempPath);
    if (fullDigest !== CBDB_OFFICIAL_SQLITE_SHA256) {
      throw new Error(
        `CBDB sqlite checksum mismatch (got ${fullDigest}, expected ${CBDB_OFFICIAL_SQLITE_SHA256}). ` +
          'Upstream may have published a new version — update the pin here and in ' +
          'authority extraction/upstream/pins.json together.',
      );
    }

    onProgress?.({
      sourceId: 'cbdb',
      fileName: 'cbdb-person.sqlite3',
      phase: 'extracting',
      receivedBytes: 0,
      totalBytes: null,
    });
    const extractionRoot = resolveAuthorityExtractionRoot('cbdb/stripReferenceDb.mjs');
    await runNodeScript(
      path.join(extractionRoot, 'cbdb/stripReferenceDb.mjs'),
      ['--sqlite', fullSqliteTempPath, '--out', strippedTempPath],
      extractionRoot,
    );
    await fsp.rm(fullSqliteTempPath, { force: true });

    const strippedDigest = await sha256File(strippedTempPath);
    const strippedStat = await fsp.stat(strippedTempPath);

    await fsp.rename(strippedTempPath, path.join(baseDir, 'cbdb-person.sqlite3'));
    // Legacy compile path still looks for cbdb.sqlite3.
    await fsp.copyFile(
      path.join(baseDir, 'cbdb-person.sqlite3'),
      path.join(baseDir, 'cbdb.sqlite3'),
    );

    const manifest: AuthorityManifest = {
      source: 'cbdb',
      version: CBDB_OFFICIAL_VERSION,
      files: [
        {
          fileName: 'cbdb-person.sqlite3',
          sha256: strippedDigest,
          bytes: strippedStat.size,
          upstreamUrl: CBDB_OFFICIAL_ZIP_URL,
        },
      ],
      installedAt: new Date().toISOString(),
    };
    await writeSourceManifest(baseDir, manifest);
    return manifest;
  } catch (error) {
    for (const tempPath of tempPaths) {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined);
    }
    throw error;
  }
};

/**
 * Download and install one source. CBDB fetches its own official release
 * directly and strips it locally (downloadCbdbDirect); Norbert still comes
 * from our reference-person zip (downloadNorbertReferenceBundle); DILA
 * downloads its three TEI files individually. Files land under temp names
 * and are renamed into place only after checksum verification; the manifest
 * is written last, so a crashed download never yields an "installed" source.
 */
export const downloadAuthoritySource = async (
  baseDir: string,
  id: AuthoritySourceId,
  onProgress?: (progress: AuthorityDownloadProgress) => void,
): Promise<AuthorityManifest> => {
  if (id === 'cbdb') return downloadCbdbDirect(baseDir, onProgress);
  if (id === 'norbert') return downloadNorbertReferenceBundle(baseDir, onProgress);

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
        await downloadToFile(
          file.url,
          zipTempPath,
          (receivedBytes, totalBytes) =>
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
        await downloadToFile(
          file.url,
          tempPath,
          (receivedBytes, totalBytes) =>
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
      await fsp.rename(
        path.join(baseDir, `${file.fileName}.download`),
        path.join(baseDir, file.fileName),
      );
    }
    const manifest: AuthorityManifest = {
      source: id,
      version: spec.version,
      files: installedFiles,
      installedAt: new Date().toISOString(),
    };
    await writeSourceManifest(baseDir, manifest);
    return manifest;
  } catch (error) {
    for (const tempPath of tempPaths) {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined);
    }
    throw error;
  }
};
