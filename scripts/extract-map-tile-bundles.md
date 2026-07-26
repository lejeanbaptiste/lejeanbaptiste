# Extracting Local PMTiles Bundles

LEAF-Writer keeps its basemap tiles on disk under the Electron user-data folder.
The desktop app can also copy bundles from a staged local source directory when
`LEAFWRITER_MAP_TILES_SOURCE_DIR` is set.

Use this workflow to generate the staged bundles from Protomaps:

1. Download a recent daily basemap build from Protomaps.
   The docs currently show an example like:

   ```sh
   pmtiles show https://build.protomaps.com/20260722.pmtiles
   ```

2. Extract the region you want into a regional `.pmtiles` file.

   ```sh
   pmtiles extract \
     https://build.protomaps.com/20260722.pmtiles \
     china.pmtiles \
     --bbox=73.5,15.8,134.8,53.6
   ```

   Repeat for Tibet and Japan with their own bounding boxes.

3. Optionally verify and cluster the output.

   ```sh
   pmtiles verify china.pmtiles
   pmtiles cluster china.pmtiles
   ```

4. Put the resulting files in a local folder, for example:

   ```text
   ~/leafwriter-map-tiles/
     china.pmtiles
     tibet.pmtiles
     japan.pmtiles
   ```

5. Point LEAF-Writer at that folder before launching the desktop app.

   ```sh
   export LEAFWRITER_MAP_TILES_SOURCE_DIR=~/leafwriter-map-tiles
   ```

At runtime, LEAF-Writer will:

- Copy the staged bundle into its on-disk map cache.
- Verify the SHA-256 checksum from the bundle metadata.
- Serve tiles locally through the `pmtiles://` protocol handler.

If you prefer hosted bundles instead of a staged local folder, replace the
bundle URLs in `regionalBundles.ts` with the published `.pmtiles` URLs and the
desktop installer will download them into the same on-disk cache.
