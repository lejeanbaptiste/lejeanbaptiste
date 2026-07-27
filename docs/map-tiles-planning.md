# Regional PMTiles download and cache plan

Status: implemented in the desktop acquisition path; regional assets are
published by the `authoritypacks` GitHub release pipeline (2026-07-27)

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

The `authoritypacks` release pipeline publishes pre-extracted `china.pmtiles`,
`japan.pmtiles`, and `tibet.pmtiles` assets. LeafWriter downloads the selected
regional archive from the stable GitHub `releases/latest/download` URL and
caches it locally. Runtime extraction remains available only as a development
fallback for legacy bundle definitions.

## Proposed flow

### 1. Build and publish regional assets

On a tagged `authoritypacks` release, CI resolves the newest available daily
build, extracts the three configured regions with the official `pmtiles` CLI,
verifies each archive, and uploads the files plus `map-tiles-index.json` to the
GitHub Release. The index records the source build and SHA-256 checksums.

### 2. Download the published asset

The Electron main process checks the current UTC date and preceding dates until
it finds an available build. The selected URL is recorded in the installed map
tile manifest, so an unchanged daily build is reused without extraction.

Example:

```sh
https://build.protomaps.com/YYYYMMDD.pmtiles
```

The build date should be recorded in the bundle manifest so the extraction can
be repeated later if needed.

### 3. Extract regional cutouts (CI only)

The desktop installer invokes the official `pmtiles extract` command with the
bundle bounding boxes already defined in `regionalBundles.ts`. Packaging now
downloads the pinned official executable into the app's `resources/pmtiles`
directory; development can override it with `LEAFWRITER_PMTILES_BIN`.

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

### 4. Stage the files locally

Put the extracted files in a user-controlled folder, for example:

```text
~/leafwriter-map-tiles/
  china.pmtiles
  tibet.pmtiles
  japan.pmtiles
```

For development and manual installs, LEAF-Writer can read from a staged folder
via `LEAFWRITER_MAP_TILES_SOURCE_DIR`.

### 5. Install into the app cache

When the user clicks a regional tile download action:

1. The app checks whether the regional bundle is already installed.
2. If not, it downloads the published region asset (or copies a staged file).
3. It verifies the SHA-256 checksum.
4. It writes the file into the map-tiles cache under Electron user data.
5. It records the installed bundle in `map-tiles.manifest.json`.

After that, the map uses the cached file only.

### 6. Serve tiles locally

Once installed, the renderer points MapLibre at:

```text
pmtiles://<bundleId>/{z}/{x}/{y}.mvt
```

No external tile requests are needed after installation.

## Implementation steps

1. Keep the local cache and `pmtiles://` serving path in `mapTiles.ts`.
2. Keep the staged-folder path as an advanced fallback for development and
   troubleshooting.
4. Add or update tests for:
   - install from local staged source
   - install from remote URL
   - checksum verification
   - cache reuse without re-download

## Recommendation

The release pipeline does the expensive extraction once. The app downloads the
finished regional archive, verifies it, caches it on disk, and reuses it
through the existing `pmtiles://` protocol.

That keeps the app offline after the initial download and avoids any new tile
server dependency.
