import {
  boundsContain,
  findBundleForPoint,
  regionalBundleForLanguage,
  REGIONAL_BUNDLES,
  type MapTileBundleSpec,
} from './regionalBundles';

describe('regionalBundles', () => {
  it('reports whether a point falls within a bounding box', () => {
    const bounds = { north: 10, south: 0, east: 10, west: 0 };
    expect(boundsContain(bounds, 5, 5)).toBe(true);
    expect(boundsContain(bounds, 0, 0)).toBe(true); // inclusive edges
    expect(boundsContain(bounds, 10, 10)).toBe(true);
    expect(boundsContain(bounds, -1, 5)).toBe(false);
    expect(boundsContain(bounds, 5, 11)).toBe(false);
  });

  it('finds the china bundle for a point in Beijing', () => {
    const found = findBundleForPoint(REGIONAL_BUNDLES, 39.9, 116.4);
    expect(found?.id).toBe('china');
  });

  it('finds the japan bundle for a point in Tokyo', () => {
    const found = findBundleForPoint(REGIONAL_BUNDLES, 35.68, 139.69);
    expect(found?.id).toBe('japan');
  });

  it('finds the tibet bundle for a point in Lhasa', () => {
    const found = findBundleForPoint(REGIONAL_BUNDLES, 29.65, 91.13);
    expect(found?.id).toBe('tibet');
  });

  it('returns undefined for a point outside every registered bundle', () => {
    // Middle of the Atlantic.
    expect(findBundleForPoint(REGIONAL_BUNDLES, 30, -40)).toBeUndefined();
  });

  it('maps a project source language to its recommended bundle', () => {
    expect(regionalBundleForLanguage('zh')?.id).toBe('china');
    expect(regionalBundleForLanguage('ja')?.id).toBe('japan');
    expect(regionalBundleForLanguage('bo')?.id).toBe('tibet');
    expect(regionalBundleForLanguage('fr')).toBeUndefined();
    expect(regionalBundleForLanguage(undefined)).toBeUndefined();
  });

  it('gives every bundle a distinct id and non-empty label', () => {
    const ids = REGIONAL_BUNDLES.map((b: MapTileBundleSpec) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const bundle of REGIONAL_BUNDLES) expect(bundle.label.length).toBeGreaterThan(0);
  });
});
