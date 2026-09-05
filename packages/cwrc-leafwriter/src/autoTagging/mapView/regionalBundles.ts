/**
 * Pre-coded regional PMTiles basemap bundles (Phase 6, "multi-region" follow-up
 * to docs/placename-geo-disambiguation-planning.md). Extracted from Protomaps'
 * free, no-account, ODbL-licensed daily planet build (build.protomaps.com) via
 * `pmtiles extract --bbox=...` — see scripts/extract-map-tile-bundles.md for
 * how to regenerate these.
 *
 * Regional archives are built and verified by CI in the authoritypacks release
 * repository, then downloaded and cached locally by the Electron app.
 */

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapTileBundleSpec {
  /** Stable id for this regional bundle, e.g. "china". Matches the manifest key on disk. */
  id: string;
  /** Human-readable label for settings UI and dialogs, e.g. "China". */
  label: string;
  /** ISO 639-1 source-language codes this bundle should auto-load for (see projectLang). */
  languages: string[];
  bounds: GeoBounds;
  /** Main-process source kind; release assets are already regionally extracted. */
  source: 'authoritypacks-release';
  url: string;
  bbox: [number, number, number, number];
  fileName: string;
  bytes?: number;
  sha256?: string;
}

export function isConfiguredMapTileBundle(bundle: MapTileBundleSpec): boolean {
  return bundle.source === 'authoritypacks-release' && bundle.bbox.length === 4;
}

// Tibet's bounds sit entirely inside China's — listed first so
// findBundleForPoint (first-match-wins) prefers the more specific region.
export const REGIONAL_BUNDLES: MapTileBundleSpec[] = [
  {
    id: 'tibet',
    label: 'Tibet',
    languages: ['bo'],
    bounds: { north: 39.8, south: 26.0, east: 103.5, west: 78.0 },
    source: 'authoritypacks-release',
    url: 'https://github.com/grognard/authoritypacks/releases/latest/download/tibet.pmtiles',
    bbox: [78.0, 26.0, 103.5, 39.8],
    fileName: 'tibet.pmtiles',
  },
  {
    id: 'china',
    label: 'China',
    languages: ['zh'],
    bounds: { north: 53.6, south: 15.8, east: 134.8, west: 73.5 },
    source: 'authoritypacks-release',
    url: 'https://github.com/grognard/authoritypacks/releases/latest/download/china.pmtiles',
    bbox: [73.5, 15.8, 134.8, 53.6],
    fileName: 'china.pmtiles',
  },
  {
    id: 'japan',
    label: 'Japan',
    languages: ['ja'],
    bounds: { north: 45.7, south: 24.0, east: 154.0, west: 122.9 },
    source: 'authoritypacks-release',
    url: 'https://github.com/grognard/authoritypacks/releases/latest/download/japan.pmtiles',
    bbox: [122.9, 24.0, 154.0, 45.7],
    fileName: 'japan.pmtiles',
  },
];

export function boundsContain(bounds: GeoBounds, lat: number, lon: number): boolean {
  return lat <= bounds.north && lat >= bounds.south && lon <= bounds.east && lon >= bounds.west;
}

/** MapLibre `maxBounds` / `LngLatBoundsLike`: `[[west, south], [east, north]]`. */
export function lngLatBoundsLike(bounds: GeoBounds): [[number, number], [number, number]] {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ];
}

/** First bundle (from the given list) whose bounds contain the point — bundles may legitimately overlap. */
export function findBundleForPoint(
  bundles: MapTileBundleSpec[],
  lat: number,
  lon: number,
): MapTileBundleSpec | undefined {
  return bundles.find((bundle) => boundsContain(bundle.bounds, lat, lon));
}

/** Registry bundle recommended for a project's source language, if any. */
export function regionalBundleForLanguage(lang: string | undefined): MapTileBundleSpec | undefined {
  if (!lang) return undefined;
  return REGIONAL_BUNDLES.find((bundle) => bundle.languages.includes(lang));
}
