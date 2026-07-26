import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  installMapTileBundle,
  listInstalledMapTileRegions,
  isConfiguredMapTileBundle,
  mapTileBundleInstalled,
  mapTileBundlePath,
  mapTilesManifestPath,
  parseMapTilesManifest,
  parsePmtilesTileUrl,
  readInstalledMapTilesManifest,
  removeMapTileBundle,
  type MapTileBundleSpec,
} from './mapTiles';

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');

const originalFetch = global.fetch;

function makeBundle(overrides: Partial<MapTileBundleSpec> = {}): MapTileBundleSpec {
  const contents = overrides.sha256 ? undefined : 'fake pmtiles bytes';
  return {
    id: 'china',
    url: 'https://example.com/china.pmtiles',
    fileName: 'china.pmtiles',
    bytes: contents?.length ?? 4,
    sha256: contents ? sha256(contents) : 'a'.repeat(64),
    ...overrides,
  };
}

describe('mapTiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'map-tiles-test-'));
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('parses a valid manifest and rejects a malformed one', () => {
    const parsed = parseMapTilesManifest(
      JSON.stringify({
        bundles: { china: { fileName: 'china.pmtiles', sha256: 'a'.repeat(64), installedAt: '2026-07-26T00:00:00Z' } },
      }),
    );
    expect(parsed?.bundles.china?.fileName).toBe('china.pmtiles');

    expect(parseMapTilesManifest('not json')).toBeNull();
    expect(parseMapTilesManifest(JSON.stringify({ bundles: { china: { fileName: 'x' } } }))).toBeNull();
  });

  it('reports no manifest, no regions, and no installed bundle when nothing has been downloaded yet', async () => {
    expect(await readInstalledMapTilesManifest(tempDir)).toBeNull();
    expect(await listInstalledMapTileRegions(tempDir)).toEqual([]);
    expect(await mapTileBundleInstalled(tempDir, { id: 'china', sha256: 'a'.repeat(64) })).toBe(false);
  });

  it('downloads, verifies, and installs a bundle, writing a manifest that round-trips', async () => {
    const contents = 'fake pmtiles bytes for china';
    const bundle = makeBundle({ bytes: contents.length, sha256: sha256(contents) });

    global.fetch = jest.fn().mockResolvedValue(
      new Response(contents, { status: 200, headers: { 'content-length': String(contents.length) } }),
    ) as unknown as typeof fetch;

    const onProgress = jest.fn();
    const result = await installMapTileBundle({ mapTilesDir: tempDir, bundle, onProgress });

    expect(result.installed).toBe(true);
    expect(result.path).toBe(mapTileBundlePath(tempDir, bundle));
    expect(await fs.readFile(result.path, 'utf-8')).toBe(contents);
    expect(onProgress).toHaveBeenCalled();

    const manifest = await readInstalledMapTilesManifest(tempDir);
    expect(manifest?.bundles.china?.sha256).toBe(bundle.sha256);
    expect(await mapTileBundleInstalled(tempDir, bundle)).toBe(true);

    // Re-installing the same bundle is a no-op (not re-downloaded).
    global.fetch = jest.fn();
    const second = await installMapTileBundle({ mapTilesDir: tempDir, bundle });
    expect(second.installed).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('installs multiple regional bundles side by side without clobbering each other', async () => {
    const chinaContents = 'china bytes';
    const japanContents = 'japan bytes!!';
    const chinaBundle = makeBundle({ id: 'china', fileName: 'china.pmtiles', bytes: chinaContents.length, sha256: sha256(chinaContents) });
    const japanBundle = makeBundle({ id: 'japan', fileName: 'japan.pmtiles', bytes: japanContents.length, sha256: sha256(japanContents) });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(chinaContents, { status: 200, headers: { 'content-length': String(chinaContents.length) } }))
      .mockResolvedValueOnce(new Response(japanContents, { status: 200, headers: { 'content-length': String(japanContents.length) } })) as unknown as typeof fetch;

    await installMapTileBundle({ mapTilesDir: tempDir, bundle: chinaBundle });
    await installMapTileBundle({ mapTilesDir: tempDir, bundle: japanBundle });

    const regions = await listInstalledMapTileRegions(tempDir);
    expect(regions.map((r) => r.id).sort()).toEqual(['china', 'japan']);
    expect(await mapTileBundleInstalled(tempDir, chinaBundle)).toBe(true);
    expect(await mapTileBundleInstalled(tempDir, japanBundle)).toBe(true);
  });

  it('removes an installed bundle without touching other installed regions', async () => {
    const chinaContents = 'china bytes';
    const japanContents = 'japan bytes!!';
    const chinaBundle = makeBundle({ id: 'china', fileName: 'china.pmtiles', bytes: chinaContents.length, sha256: sha256(chinaContents) });
    const japanBundle = makeBundle({ id: 'japan', fileName: 'japan.pmtiles', bytes: japanContents.length, sha256: sha256(japanContents) });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(chinaContents, { status: 200, headers: { 'content-length': String(chinaContents.length) } }))
      .mockResolvedValueOnce(new Response(japanContents, { status: 200, headers: { 'content-length': String(japanContents.length) } })) as unknown as typeof fetch;

    await installMapTileBundle({ mapTilesDir: tempDir, bundle: chinaBundle });
    await installMapTileBundle({ mapTilesDir: tempDir, bundle: japanBundle });

    await removeMapTileBundle(tempDir, 'china');

    const regions = await listInstalledMapTileRegions(tempDir);
    expect(regions.map((r) => r.id)).toEqual(['japan']);
    await expect(fs.access(path.join(tempDir, 'china.pmtiles'))).rejects.toThrow();
    await expect(fs.access(path.join(tempDir, 'japan.pmtiles'))).resolves.toBeUndefined();
  });

  it('rejects a download whose bytes do not match the expected checksum', async () => {
    const bundle = makeBundle({ bytes: 4, sha256: 'a'.repeat(64) });

    global.fetch = jest.fn().mockResolvedValue(
      new Response('oops', { status: 200, headers: { 'content-length': '4' } }),
    ) as unknown as typeof fetch;

    await expect(installMapTileBundle({ mapTilesDir: tempDir, bundle })).rejects.toThrow(
      'checksum verification',
    );
    expect(await readInstalledMapTilesManifest(tempDir)).toBeNull();
  });

  it('rejects a bundle whose declared size exceeds the 500 MB cap before downloading', async () => {
    const bundle = makeBundle({ id: 'too-big', fileName: 'too-big.pmtiles', bytes: 600 * 1024 * 1024, sha256: 'a'.repeat(64) });
    global.fetch = jest.fn();

    await expect(installMapTileBundle({ mapTilesDir: tempDir, bundle })).rejects.toThrow('exceeds the');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects placeholder bundle metadata before attempting a network fetch', async () => {
    const bundle = makeBundle({
      id: 'china',
      url: 'https://TODO-replace-with-real-hosted-url/china.pmtiles',
      bytes: 0,
      sha256: '0'.repeat(64),
    });
    global.fetch = jest.fn();

    expect(isConfiguredMapTileBundle(bundle)).toBe(false);
    await expect(installMapTileBundle({ mapTilesDir: tempDir, bundle })).rejects.toThrow(
      'has not been configured yet',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('copies a staged local pmtiles file when the source directory override is set', async () => {
    const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'map-tiles-source-'));
    const contents = 'staged china pmtiles bytes';
    const sourcePath = path.join(sourceDir, 'china.pmtiles');
    await fs.writeFile(sourcePath, contents, 'utf-8');

    const bundle = makeBundle({
      id: 'china',
      url: 'https://TODO-replace-with-real-hosted-url/china.pmtiles',
      fileName: 'china.pmtiles',
      bytes: contents.length,
      sha256: sha256(contents),
    });

    const originalSourceDir = process.env.LEAFWRITER_MAP_TILES_SOURCE_DIR;
    process.env.LEAFWRITER_MAP_TILES_SOURCE_DIR = sourceDir;
    global.fetch = jest.fn();

    try {
      expect(isConfiguredMapTileBundle(bundle)).toBe(true);
      const result = await installMapTileBundle({ mapTilesDir: tempDir, bundle });

      expect(result.installed).toBe(true);
      expect(await fs.readFile(result.path, 'utf-8')).toBe(contents);
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      if (originalSourceDir === undefined) {
        delete process.env.LEAFWRITER_MAP_TILES_SOURCE_DIR;
      } else {
        process.env.LEAFWRITER_MAP_TILES_SOURCE_DIR = originalSourceDir;
      }
      await fs.rm(sourceDir, { recursive: true, force: true });
    }
  });

  it('builds a stable manifest path under the map tiles directory', () => {
    expect(mapTilesManifestPath(tempDir)).toBe(path.join(tempDir, 'map-tiles.manifest.json'));
  });

  it('parses bundle id + z/x/y out of a pmtiles:// tile URL regardless of extension', () => {
    expect(parsePmtilesTileUrl('pmtiles://china/5/10/12.mvt')).toEqual({
      bundleId: 'china',
      z: 5,
      x: 10,
      y: 12,
    });
    expect(parsePmtilesTileUrl('pmtiles://japan/0/0/0.pbf')).toEqual({
      bundleId: 'japan',
      z: 0,
      x: 0,
      y: 0,
    });
    expect(parsePmtilesTileUrl('pmtiles://china/not-a-tile')).toBeNull();
  });
});
