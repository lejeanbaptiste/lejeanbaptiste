import { allWeaponElementIds, applyDisplayToggles } from './bodyAssets';

describe('applyDisplayToggles', () => {
  it('lets an id match win over a colliding inkscape:label match on the same tag', () => {
    // Reproduces bodies/body7.svg's rank-3 weapon pieces: labeled plainly
    // "m-rank3" (no a/b variant suffix, since rank 3 has only one), which
    // collides with the outer m-rank3 decoration group's own label. The
    // weapon must show because its id was requested, even though the
    // player's displayed rank isn't 3 (so the label pass alone would hide it).
    const svg =
      '<svg>' +
      '<g inkscape:label="m-rank3"><image id="image6" inkscape:label="m-rank3" /></g>' +
      '</svg>';
    const labelValues = new Map([['m-rank3', 'none' as const]]);
    const idValues = new Map([['image6', 'inline' as const]]);

    const out = applyDisplayToggles(svg, labelValues, idValues);

    const imageTag = /<image\b[^>]*>/.exec(out)![0];
    expect(imageTag).toContain('display:inline');
  });

  it('still hides a colliding tag when its id was not requested', () => {
    const svg =
      '<svg>' +
      '<g inkscape:label="m-rank3"><image id="image6" inkscape:label="m-rank3" /></g>' +
      '</svg>';
    const labelValues = new Map([['m-rank3', 'inline' as const]]);
    const idValues = new Map([['image6', 'none' as const]]);

    const out = applyDisplayToggles(svg, labelValues, idValues);

    const imageTag = /<image\b[^>]*>/.exec(out)![0];
    expect(imageTag).toContain('display:none');
  });

  it('applies label-only and id-only toggles independently when there is no collision', () => {
    const svg =
      '<svg>' +
      '<g inkscape:label="middle" />' +
      '<image id="image4" inkscape:label="m-rank2-a" />' +
      '</svg>';
    const labelValues = new Map([['middle', 'inline' as const]]);
    const idValues = new Map([['image4', 'inline' as const]]);

    const out = applyDisplayToggles(svg, labelValues, idValues);

    expect(/<g\b[^>]*>/.exec(out)![0]).toContain('display:inline');
    expect(/<image\b[^>]*>/.exec(out)![0]).toContain('display:inline');
  });
});

describe('allWeaponElementIds', () => {
  it("collects a labelled <g> wrapper's id alongside the images inside it", () => {
    // Reproduces bodies/body11.svg, which wraps each weapon variant in its
    // own display:none <g> carrying the same label as its images. Missing
    // the wrapper id meant the wrapper stayed hidden and the weapon never
    // rendered, however many leaf images were switched to display:inline.
    const svg =
      '<svg><g inkscape:label="weapons">' +
      '<g inkscape:label="m-wwii4" id="g28" style="display:none">' +
      '<image id="image90" inkscape:label="m-wwii4" />' +
      '<image id="image91" inkscape:label="m-wwii4" />' +
      '</g></g></svg>';
    expect(allWeaponElementIds(svg)).toEqual(['g28', 'image90', 'image91']);
  });

  it('ignores an unlabelled structural <g> inside the weapons block', () => {
    const svg =
      '<svg><g inkscape:label="weapons">' +
      '<g id="layer-transform"><image id="image7" inkscape:label="wwi1" /></g>' +
      '</g></svg>';
    expect(allWeaponElementIds(svg)).toEqual(['image7']);
  });

  it('finds elements across every weapons block a pose has', () => {
    const svg =
      '<svg>' +
      '<g inkscape:label="weapons"><image id="rear" inkscape:label="wwi1" /></g>' +
      '<g inkscape:label="Weapons"><image id="front" inkscape:label="wwi1" /></g>' +
      '</svg>';
    expect(allWeaponElementIds(svg)).toEqual(['rear', 'front']);
  });
});
