/**
 * Download and install local PMTiles regional basemap bundles for the
 * place-name geo-comparison map (see
 * docs/placename-geo-disambiguation-planning.md, Phase 6, and
 * packages/cwrc-leafwriter/src/autoTagging/mapView/regionalBundles.ts for the
 * pre-coded China/Japan/Tibet bundle specs). Mirrors
 * authorityPackRegistry.ts's download/verify/atomic-rename shape, but for a
 * single .pmtiles file rather than a tarball of packs — no extraction step
 * needed on install (extraction from Protomaps' planet build happens once,
 * offline, when the bundle is produced — see regionalBundles.ts's doc
 * comment).
 *
 * Multiple regional bundles can be installed side by side (a project might
 * touch both Chinese and Japanese place names) — the manifest is keyed by
 * bundle id, and the `pmtiles://` protocol handler resolves which installed
 * file to read from the bundle id embedded in the tile URL's host segment.
 *
 * Tile format is PMTiles (not MBTiles/SQLite): a single-file archive readable
 * by plain byte-range reads, no SQLite dependency needed — see
 * openInstalledPmtiles's NodeFileSource below.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { protocol } from 'electron';
import { Compression, PMTiles, type Source } from 'pmtiles';

import { writeFileAtomic } from './atomicWrite';
import { getMapTilesDir } from './projectPrefs';

/** Scheme MapLibre's vector style points tile URLs at — see registerPmtilesProtocol. */
export const PMTILES_SCHEME = 'pmtiles';

export const MAP_TILES_DIRNAME = 'map-tiles';
const MAP_TILES_MANIFEST_FILENAME = 'map-tiles.manifest.json';
const MAX_MAP_TILE_BUNDLE_BYTES = 500 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const MAP_TILES_SOURCE_DIR_ENV = 'LEAFWRITER_MAP_TILES_SOURCE_DIR';

export interface MapTileBundleSpec {
  /** Stable id for this regional bundle, e.g. "china". Also the tile URL's host segment. */
  id: string;
  url: string;
  fileName: string;
  bytes: number;
  sha256: string;
}

export interface MapTilesManifestEntry {
  fileName: string;
  sha256: string;
  installedAt: string;
}

export interface MapTilesManifest {
  bundles: Record<string, MapTilesManifestEntry>;
}

export const mapTilesManifestPath = (mapTilesDir: string): string =>
  path.join(mapTilesDir, MAP_TILES_MANIFEST_FILENAME);

export const mapTileBundlePath = (mapTilesDir: string, bundle: Pick<MapTileBundleSpec, 'fileName'>): string =>
  path.join(mapTilesDir, bundle.fileName);

export const parseMapTilesManifest = (raw: string): MapTilesManifest | null => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.bundles && typeof parsed.bundles === 'object') {
      for (const entry of Object.values(parsed.bundles)) {
        const e = entry as Partial<MapTilesManifestEntry>;
        if (
          typeof e?.fileName !== 'string' ||
          typeof e?.sha256 !== 'string' ||
          typeof e?.installedAt !== 'string'
        ) {
          return null;
        }
      }
      return parsed as MapTilesManifest;
    }
    return null;
  } catch {
    return null;
  }
};

export const readInstalledMapTilesManifest = async (
  mapTilesDir: string,
): Promise<MapTilesManifest | null> => {
  try {
    return parseMapTilesManifest(await fsp.readFile(mapTilesManifestPath(mapTilesDir), 'utf-8'));
  } catch {
    return null;
  }
};

const writeInstalledMapTilesManifest = async (
  mapTilesDir: string,
  manifest: MapTilesManifest,
): Promise<void> => {
  await fsp.mkdir(mapTilesDir, { recursive: true });
  await writeFileAtomic(mapTilesManifestPath(mapTilesDir), `${JSON.stringify(manifest, null, 2)}\n`);
};

/** Every installed, verified bundle — for settings UI and the region-availability warning banner. */
export const listInstalledMapTileRegions = async (
  mapTilesDir: string,
): Promise<{ id: string; sha256: string; installedAt: string }[]> => {
  const manifest = await readInstalledMapTilesManifest(mapTilesDir);
  if (!manifest) return [];
  return Object.entries(manifest.bundles).map(([id, entry]) => ({
    id,
    sha256: entry.sha256,
    installedAt: entry.installedAt,
  }));
};

/** True when the given bundle is already installed and verified by manifest. */
export const mapTileBundleInstalled = async (
  mapTilesDir: string,
  bundle: Pick<MapTileBundleSpec, 'id' | 'sha256'>,
): Promise<boolean> => {
  const manifest = await readInstalledMapTilesManifest(mapTilesDir);
  return manifest?.bundles[bundle.id]?.sha256 === bundle.sha256;
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
  maxBytes = MAX_MAP_TILE_BUNDLE_BYTES,
): Promise<void> => {
  const sourcePath = resolveLocalMapTileSourcePath(url);
  if (sourcePath) {
    await copyFileToPath(sourcePath, destPath, onChunk, maxBytes);
    return;
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} downloading ${url}`);
  }
  const contentLength = Number(response.headers.get('content-length'));
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null;
  if (totalBytes !== null && totalBytes > maxBytes) {
    throw new Error(`Download exceeds the ${maxBytes} byte limit.`);
  }

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

const resolveLocalMapTileSourcePath = (source: string): string | null => {
  const stagedDir = process.env[MAP_TILES_SOURCE_DIR_ENV]?.trim();
  if (stagedDir) {
    const stagedPath = path.join(stagedDir, path.basename(source));
    if (fs.existsSync(stagedPath)) return stagedPath;
  }

  try {
    const parsed = new URL(source);
    if (parsed.protocol === 'file:') {
      const filePath = fileURLToPath(parsed);
      if (fs.existsSync(filePath)) return filePath;
    }
  } catch {
    if (path.isAbsolute(source) && fs.existsSync(source)) return source;
  }

  return null;
};

const copyFileToPath = async (
  sourcePath: string,
  destPath: string,
  onChunk?: (receivedBytes: number, totalBytes: number | null) => void,
  maxBytes = MAX_MAP_TILE_BUNDLE_BYTES,
): Promise<void> => {
  const totalBytes = (await fsp.stat(sourcePath)).size;
  if (totalBytes > maxBytes) {
    throw new Error(`Download exceeds the ${maxBytes} byte limit.`);
  }

  let receivedBytes = 0;
  await pipeline(
    fs.createReadStream(sourcePath),
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

export interface InstallMapTileBundleOptions {
  mapTilesDir: string;
  bundle: MapTileBundleSpec;
  force?: boolean;
  onProgress?: (message: string, receivedBytes?: number, totalBytes?: number | null) => void;
}

export const isConfiguredMapTileBundle = (bundle: MapTileBundleSpec): boolean => {
  const sourcePath = resolveLocalMapTileSourcePath(bundle.url);
  return (
    (sourcePath !== null || !bundle.url.includes('TODO-replace-with-real-hosted-url')) &&
    bundle.bytes > 0 &&
    !/^0+$/.test(bundle.sha256)
  );
};

/** Download the bundle's .pmtiles file, verify its checksum, and install it atomically. */
export const installMapTileBundle = async ({
  mapTilesDir,
  bundle,
  force = false,
  onProgress,
}: InstallMapTileBundleOptions): Promise<{ installed: boolean; path: string }> => {
  if (!isConfiguredMapTileBundle(bundle)) {
    throw new Error(`Map tile bundle "${bundle.id}" has not been configured yet.`);
  }
  const destPath = mapTileBundlePath(mapTilesDir, bundle);
  if (!force && (await mapTileBundleInstalled(mapTilesDir, bundle)) && fs.existsSync(destPath)) {
    return { installed: false, path: destPath };
  }
  if (bundle.bytes > MAX_MAP_TILE_BUNDLE_BYTES) {
    throw new Error(`Map tile bundle exceeds the ${MAX_MAP_TILE_BUNDLE_BYTES} byte limit.`);
  }

  await fsp.mkdir(mapTilesDir, { recursive: true });
  const tempPath = `${destPath}.download`;

  onProgress?.(`Downloading ${bundle.fileName}…`, 0, bundle.bytes);
  const sourcePath = resolveLocalMapTileSourcePath(bundle.url);
  if (sourcePath) {
    await copyFileToPath(
      sourcePath,
      tempPath,
      (received, total) => onProgress?.('Copying map tiles…', received, total ?? bundle.bytes),
      Math.min(MAX_MAP_TILE_BUNDLE_BYTES, bundle.bytes + 8 * 1024 * 1024),
    );
  } else {
    await downloadToFile(
      bundle.url,
      tempPath,
      (received, total) => onProgress?.('Downloading map tiles…', received, total ?? bundle.bytes),
      Math.min(MAX_MAP_TILE_BUNDLE_BYTES, bundle.bytes + 8 * 1024 * 1024),
    );
  }

  onProgress?.('Verifying download…');
  const digest = await sha256File(tempPath);
  if (digest !== bundle.sha256) {
    await fsp.rm(tempPath, { force: true });
    throw new Error('Downloaded map tile bundle failed checksum verification.');
  }

  const bakPath = `${destPath}.bak`;
  await fsp.rm(bakPath, { force: true });
  if (fs.existsSync(destPath)) await fsp.rename(destPath, bakPath);
  try {
    await fsp.rename(tempPath, destPath);
  } catch (error) {
    if (fs.existsSync(bakPath) && !fs.existsSync(destPath)) await fsp.rename(bakPath, destPath);
    throw error;
  }
  await fsp.rm(bakPath, { force: true });

  const existing = await readInstalledMapTilesManifest(mapTilesDir);
  await writeInstalledMapTilesManifest(mapTilesDir, {
    bundles: {
      ...(existing?.bundles ?? {}),
      [bundle.id]: { fileName: bundle.fileName, sha256: bundle.sha256, installedAt: new Date().toISOString() },
    },
  });

  invalidatePmtilesCache(bundle.id);
  return { installed: true, path: destPath };
};

/** Delete a downloaded bundle's file and drop it from the manifest. */
export const removeMapTileBundle = async (mapTilesDir: string, bundleId: string): Promise<void> => {
  const manifest = await readInstalledMapTilesManifest(mapTilesDir);
  const entry = manifest?.bundles[bundleId];
  if (entry) {
    await fsp.rm(path.join(mapTilesDir, entry.fileName), { force: true });
    const { [bundleId]: _removed, ...rest } = manifest!.bundles;
    await writeInstalledMapTilesManifest(mapTilesDir, { bundles: rest });
  }
  invalidatePmtilesCache(bundleId);
};

/** Parses `pmtiles://<bundleId>/{z}/{x}/{y}.<ext>`. */
export function parsePmtilesTileUrl(url: string): { bundleId: string; z: number; x: number; y: number } | null {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.\w+$/);
  if (!match || !parsed.hostname) return null;
  return { bundleId: parsed.hostname, z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) };
}

/** Reads byte ranges directly from a local file — PMTiles needs no SQLite/native dependency. */
class NodeFileSource implements Source {
  constructor(private filePath: string) {}

  getKey(): string {
    return this.filePath;
  }

  async getBytes(offset: number, length: number): Promise<{ data: ArrayBuffer }> {
    const handle = await fsp.open(this.filePath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, offset);
      return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
    } finally {
      await handle.close();
    }
  }
}

/** Node has no native zstd support in older builds; Protomaps builds only ever use gzip. */
const nodeDecompress = async (buf: ArrayBuffer, compression: Compression): Promise<ArrayBuffer> => {
  if (compression === Compression.None) return buf;
  if (compression === Compression.Gzip) {
    const out = zlib.gunzipSync(Buffer.from(buf));
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  }
  if (compression === Compression.Brotli) {
    const out = zlib.brotliDecompressSync(Buffer.from(buf));
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  }
  throw new Error(`Unsupported PMTiles compression: ${compression}`);
};

const cachedArchives = new Map<string, PMTiles>();

function invalidatePmtilesCache(bundleId: string): void {
  cachedArchives.delete(bundleId);
}

/** Opens (and caches) a PMTiles reader for the given bundle id's installed file. */
async function openInstalledPmtiles(bundleId: string): Promise<PMTiles | null> {
  const cached = cachedArchives.get(bundleId);
  if (cached) return cached;

  const dir = await getMapTilesDir();
  const manifest = await readInstalledMapTilesManifest(dir);
  const entry = manifest?.bundles[bundleId];
  if (!entry) return null;

  const filePath = path.join(dir, entry.fileName);
  if (!fs.existsSync(filePath)) return null;

  const archive = new PMTiles(new NodeFileSource(filePath), undefined, nodeDecompress);
  cachedArchives.set(bundleId, archive);
  return archive;
}

/**
 * Serves vector tiles straight from a downloaded .pmtiles file over
 * `pmtiles://<bundleId>/{z}/{x}/{y}.mvt` — no local HTTP server/child
 * process, no external requests once a bundle is installed (see
 * docs/placename-geo-disambiguation-planning.md, Phase 6, WP5). Must be
 * called after `protocol.registerSchemesAsPrivileged` but can be called any
 * time before or after `app.whenReady()`.
 */
export function registerPmtilesProtocol(): void {
  protocol.handle(PMTILES_SCHEME, async (request) => {
    try {
      const tile = parsePmtilesTileUrl(request.url);
      if (!tile) return new Response(null, { status: 400 });

      const archive = await openInstalledPmtiles(tile.bundleId);
      if (!archive) return new Response(null, { status: 404 });

      const result = await archive.getZxy(tile.z, tile.x, tile.y);
      if (!result) return new Response(null, { status: 404 });

      return new Response(Buffer.from(result.data), {
        status: 200,
        headers: { 'content-type': 'application/x-protobuf' },
      });
    } catch {
      return new Response(null, { status: 500 });
    }
  });
}
