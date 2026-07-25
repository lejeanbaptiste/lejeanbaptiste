import type { AuthorityCandidate } from './authority';
import { clusterByDistance, clusterCandidatesByGeo, haversineDistanceKm } from './geoCluster';

function place(
  source: string,
  authorityId: string,
  lat: number,
  lon: number,
  primaryName = '竟陵',
): AuthorityCandidate {
  return {
    source,
    authorityId,
    kind: 'place',
    primaryName,
    searchStrings: [primaryName],
    metadata: { geo: { lat, lon } },
  };
}

describe('haversineDistanceKm', () => {
  it('is zero for identical points', () => {
    expect(haversineDistanceKm({ lat: 30, lon: 110 }, { lat: 30, lon: 110 })).toBe(0);
  });

  it('matches a known distance (roughly, within a few km)', () => {
    // Beijing (39.9042, 116.4074) to Shanghai (31.2304, 121.4737) ≈ 1067 km great-circle.
    const d = haversineDistanceKm({ lat: 39.9042, lon: 116.4074 }, { lat: 31.2304, lon: 121.4737 });
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1100);
  });
});

describe('clusterByDistance', () => {
  it('groups points within threshold, separates points beyond it', () => {
    const points = [
      { lat: 30.0, lon: 110.0 }, // cluster A
      { lat: 30.01, lon: 110.01 }, // cluster A (very close)
      { lat: 35.0, lon: 115.0 }, // cluster B, far away
    ];
    const clusters = clusterByDistance(points, 5);
    expect(clusters).toHaveLength(2);
    const sizes = clusters.map((c) => c.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it('bridges two clusters when a point is within range of both', () => {
    const points = [
      { lat: 30.0, lon: 110.0 },
      { lat: 30.09, lon: 110.0 }, // ~10km from point 0
      { lat: 30.18, lon: 110.0 }, // ~10km from point 1, ~20km from point 0 — bridges via 1
    ];
    const clusters = clusterByDistance(points, 12);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });
});

describe('clusterCandidatesByGeo', () => {
  it('resolves 3 authorities x 2 real geo-clusters at a 5km threshold (Phase 2 acceptance fixture)', () => {
    // Two genuinely distinct places both named 竟陵, ~2000km apart, each hit by
    // all three authorities within a few km of each other (the "same name,
    // different place" collision string-only matching can't resolve).
    const placeAJingling = [
      place('CBDB', 'cbdb-a', 30.65, 113.15),
      place('CHGIS', 'chgis-a', 30.652, 113.152),
      place('Wikidata', 'wd-a', 30.648, 113.148),
    ];
    const placeBJingling = [
      place('CBDB', 'cbdb-b', 39.9, 116.4),
      place('CHGIS', 'chgis-b', 39.901, 116.402),
      place('Wikidata', 'wd-b', 39.899, 116.398),
    ];

    const { clusters, noGeo } = clusterCandidatesByGeo(
      [...placeAJingling, ...placeBJingling],
      5,
    );

    expect(noGeo).toHaveLength(0);
    expect(clusters).toHaveLength(2);
    for (const cluster of clusters) {
      expect(cluster.members).toHaveLength(3);
      const sources = cluster.members.map((m) => m.source).sort();
      expect(sources).toEqual(['CBDB', 'CHGIS', 'Wikidata']);
    }
  });

  it('separates candidates with no geo into noGeo, does not drop them', () => {
    const withGeo = place('CHGIS', 'chgis-a', 30.65, 113.15);
    const withoutGeo: AuthorityCandidate = {
      source: 'DILA',
      authorityId: 'dila-a',
      kind: 'place',
      primaryName: '竟陵',
      searchStrings: ['竟陵'],
      metadata: {},
    };

    const { clusters, noGeo } = clusterCandidatesByGeo([withGeo, withoutGeo], 5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toEqual([withGeo]);
    expect(noGeo).toEqual([withoutGeo]);
  });

  it('computes a centroid for each cluster', () => {
    const members = [place('CBDB', 'a', 30.0, 110.0), place('CHGIS', 'b', 30.02, 110.02)];
    const { clusters } = clusterCandidatesByGeo(members, 5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].centroid.lat).toBeCloseTo(30.01, 2);
    expect(clusters[0].centroid.lon).toBeCloseTo(110.01, 2);
  });
});
