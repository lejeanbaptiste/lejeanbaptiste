/**
 * Geo-proximity clustering for place-authority candidates (Phase 2 of the
 * placename geo-disambiguation plan — see
 * docs/placename-geo-disambiguation-planning.md). Pure, no I/O: given a set
 * of candidates that share a matched name string, groups the geo-bearing
 * ones by proximity so "N candidates" becomes "N candidates in M clusters"
 * for the disambiguation UI.
 */
import type { AuthorityCandidate } from './authority';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface GeoCluster<T> {
  /** Mean point of the cluster's members — not stored, just derived for display. */
  centroid: GeoPoint;
  members: T[];
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two WGS84 points, in kilometers. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/** Arithmetic mean of a set of points — fine at cluster scale, not geodesically exact over large distances. */
export function centroidOf(points: GeoPoint[]): GeoPoint {
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
  return { lat, lon };
}

/**
 * Single-link clustering: two points join a cluster if either is within
 * `thresholdKm` of *any* current member (not just the centroid). Adequate at
 * this scale (tens of candidates, not thousands) — see Phase 2 acceptance
 * criterion in the planning doc.
 */
export function clusterByDistance(points: GeoPoint[], thresholdKm: number): number[][] {
  const clusters: number[][] = [];

  for (let i = 0; i < points.length; i++) {
    const joinable = clusters.filter((cluster) =>
      cluster.some((memberIdx) => haversineDistanceKm(points[memberIdx], points[i]) <= thresholdKm),
    );

    if (joinable.length === 0) {
      clusters.push([i]);
      continue;
    }

    // Merge every cluster this point bridges (it may connect two previously
    // separate clusters), then add the point.
    const merged = joinable.flat();
    merged.push(i);
    for (const cluster of joinable) clusters.splice(clusters.indexOf(cluster), 1);
    clusters.push(merged);
  }

  return clusters;
}

/**
 * Groups items by geo proximity using an explicit accessor, so it works for
 * any item shape that carries a geo point somewhere — `AuthorityCandidate`
 * (`metadata.geo`), `DisambiguationCandidate` (`geo` at the top level), or a
 * future shape. Items the accessor returns no point for come back separately
 * as `noGeo` — the caller should fall back to today's plain string/crosswalk
 * behavior for those, per the disambiguation-UI design ("no geo data" label),
 * not silently drop them.
 */
export function clusterByGeoAccessor<T>(
  items: T[],
  thresholdKm: number,
  getGeo: (item: T) => GeoPoint | undefined,
): { clusters: GeoCluster<T>[]; noGeo: T[] } {
  const geoBearing: { item: T; point: GeoPoint }[] = [];
  const noGeo: T[] = [];

  for (const item of items) {
    const geo = getGeo(item);
    if (geo) geoBearing.push({ item, point: geo });
    else noGeo.push(item);
  }

  const points = geoBearing.map((g) => g.point);
  const indexClusters = clusterByDistance(points, thresholdKm);

  const clusters: GeoCluster<T>[] = indexClusters.map((indices) => {
    const members = indices.map((i) => geoBearing[i].item);
    const clusterPoints = indices.map((i) => geoBearing[i].point);
    return { centroid: centroidOf(clusterPoints), members };
  });

  return { clusters, noGeo };
}

/** {@link clusterByGeoAccessor} specialized for `AuthorityCandidate`-shaped input (`metadata.geo`). */
export function clusterCandidatesByGeo<T extends AuthorityCandidate>(
  candidates: T[],
  thresholdKm: number,
): { clusters: GeoCluster<T>[]; noGeo: T[] } {
  return clusterByGeoAccessor(candidates, thresholdKm, (candidate) => candidate.metadata?.geo);
}
