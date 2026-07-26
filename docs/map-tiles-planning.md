# Regional PMTiles download and cache plan

Status: planning (2026-07-26)

Related:
- [placename-geo-disambiguation-planning.md](placename-geo-disambiguation-planning.md)
- [map-app.md](map-app.md)
- [`apps/desktop/src/mapTiles.ts`](../apps/desktop/src/mapTiles.ts)
- [`packages/cwrc-leafwriter/src/autoTagging/mapView/regionalBundles.ts`](../packages/cwrc-leafwriter/src/autoTagging/mapView/regionalBundles.ts)

## Goal

Let LEAF-Writer fetch basemap tiles once, keep them on disk, and reuse them
offline afterward.

The app already has the storage and serving layer:

- `mapTiles.ts` downloads or copies a `.pmtiles` archive into the user-data cache.
- The `pmtiles://<bundleId>/{z}/{x}/{y}.mvt` protocol handler serves tiles from the cached archive.
- The map UI already switches to that local protocol when a bundle is installed.

What remains is the acquisition workflow:

1. Identify a real upstream PMTiles source.
2. Extract regional cutouts from that source.
3. Make the regional archives available to LEAF-Writer.
4. Keep the downloaded archives in the local cache and reuse them.

## Source of truth

The upstream source is the Protomaps daily basemap build:

- Build page: `https://build.protomaps.com/<YYYYMMDD>.pmtiles`
- Protomaps docs: `pmtiles extract INPUT.pmtiles OUTPUT.pmtiles --bbox=...`
- Optional mirror: `https://data.source.coop/protomaps/openstreetmap/v4.pmtiles`

The repo does **not** currently rely on pre-published `china.pmtiles`,
`japan.pmtiles`, or `tibet.pmtiles` URLs. Instead, the regional bundles are
created from the daily build and then cached locally.

## Proposed flow

### 1. Pick a build

Use a pinned daily build URL for reproducibility.

Example:

```sh
https://build.protomaps.com/20260722.pmtiles
```

The build date should be recorded in the bundle manifest so the extraction can
be repeated later if needed.

### 2. Extract regional cutouts

Use `pmtiles extract` with the bundle bounding boxes already defined in
`regionalBundles.ts`.

Example:

```sh
pmtiles extract \
  https://build.protomaps.com/20260722.pmtiles \
  china.pmtiles \
  --bbox=73.5,15.8,134.8,53.6
```

Repeat for Tibet and Japan.

Recommended post-step:

```sh
pmtiles verify china.pmtiles
pmtiles cluster china.pmtiles
```

### 3. Stage the files locally

Put the extracted files in a user-controlled folder, for example:

```text
~/leafwriter-map-tiles/
  china.pmtiles
  tibet.pmtiles
  japan.pmtiles
```

For development and manual installs, LEAF-Writer can read from a staged folder
via `LEAFWRITER_MAP_TILES_SOURCE_DIR`.

### 4. Install into the app cache

When the user opens the map or clicks the tile download action:

1. The app checks whether the regional bundle is already installed.
2. If not, it copies the staged file or downloads the remote file.
3. It verifies the SHA-256 checksum.
4. It writes the file into the map-tiles cache under Electron user data.
5. It records the installed bundle in `map-tiles.manifest.json`.

After that, the map uses the cached file only.

### 5. Serve tiles locally

Once installed, the renderer points MapLibre at:

```text
pmtiles://<bundleId>/{z}/{x}/{y}.mvt
```

No external tile requests are needed after installation.

## Implementation steps

1. Replace the placeholder bundle metadata in `regionalBundles.ts` with real
   download metadata once the extraction/publishing location is decided.
2. Keep the local cache and `pmtiles://` serving path in `mapTiles.ts`.
3. Add an installer action in the UI so users can trigger bundle setup without
   touching environment variables.
4. Keep the staged-folder path as an advanced fallback for development and
   troubleshooting.
5. Add or update tests for:
   - install from local staged source
   - install from remote URL
   - checksum verification
   - cache reuse without re-download

## Open questions

1. Should the first shipped version use the Protomaps daily build directly, or
   should we publish our own pre-extracted regional bundles somewhere stable?
2. Should the app expose a folder-picker fallback in Settings, or keep the
   staged-folder path internal to development only?
3. Should the bundle selection be automatic by current view / language, or
   should the user explicitly choose a region the first time?

## Recommendation

Ship the simplest useful version first:

- download from a pinned Protomaps daily build,
- extract the regional archives,
- cache them on disk,
- reuse them through the existing `pmtiles://` protocol.

That keeps the app offline after the initial download and avoids any new tile
server dependency.
