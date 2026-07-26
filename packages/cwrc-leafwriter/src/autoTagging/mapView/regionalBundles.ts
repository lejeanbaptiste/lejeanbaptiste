/**
 * Pre-coded regional PMTiles basemap bundles (Phase 6, "multi-region" follow-up
 * to docs/placename-geo-disambiguation-planning.md). Extracted from Protomaps'
 * free, no-account, ODbL-licensed daily planet build (build.protomaps.com) via
 * `pmtiles extract --bbox=...` — see scripts/extract-map-tile-bundles.md for
 * how to regenerate these.
 *
 * NOTE: url/bytes/sha256 below are placeholders. The actual extraction (each
 * region is tens to low-hundreds of MB) and hosting of the resulting files is
 * a separate, explicit step — not something to run unattended, since it's a
 * long-running download/upload job. Once real files exist, replace the three
 * placeholder fields per bundle; nothing else in the app needs to change.
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
  url: string;
  fileName: string;
  bytes: number;
  sha256: string;
}

export function isConfiguredMapTileBundle(bundle: MapTileBundleSpec): boolean {
  return (
    !bundle.url.includes('TODO-replace-with-real-hosted-url') &&
    bundle.bytes > 0 &&
    !/^0+$/.test(bundle.sha256)
  );
}

// TODO(map-tiles): replace url/bytes/sha256 with real values once each region
// has actually been extracted and hosted — see the module doc comment above.
//
// Tibet's bounds sit entirely inside China's — listed first so
// findBundleForPoint (first-match-wins) prefers the more specific region.
export const REGIONAL_BUNDLES: MapTileBundleSpec[] = [
  {
    id: 'tibet',
    label: 'Tibet',
    languages: ['bo'],
    bounds: { north: 39.8, south: 26.0, east: 103.5, west: 78.0 },
    url: 'https://TODO-replace-with-real-hosted-url/tibet.pmtiles',
    fileName: 'tibet.pmtiles',
    bytes: 0,
    sha256: '0'.repeat(64),
  },
  {
    id: 'china',
    label: 'China',
    languages: ['zh'],
    bounds: { north: 53.6, south: 15.8, east: 134.8, west: 73.5 },
    url: 'https://TODO-replace-with-real-hosted-url/china.pmtiles',
    fileName: 'china.pmtiles',
    bytes: 0,
    sha256: '0'.repeat(64),
  },
  {
    id: 'japan',
    label: 'Japan',
    languages: ['ja'],
    bounds: { north: 45.7, south: 24.0, east: 154.0, west: 122.9 },
    url: 'https://TODO-replace-with-real-hosted-url/japan.pmtiles',
    fileName: 'japan.pmtiles',
    bytes: 0,
    sha256: '0'.repeat(64),
  },
];

export function boundsContain(bounds: GeoBounds, lat: number, lon: number): boolean {
  return lat <= bounds.north && lat >= bounds.south && lon <= bounds.east && lon >= bounds.west;
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
