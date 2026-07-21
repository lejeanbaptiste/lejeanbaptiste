export interface ColorStats {
  lightness: number;
  saturation: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

// A sprite that's already close to the target needs no correction; the
// clamp keeps a wildly mismatched pair from being pushed so far it looks
// discolored rather than blended. Measured against the real assets (all 22
// backdrops average saturation ~0.06-0.37; the uniform coat ~0.61, the
// DiceBear head ~0.52), the real ratios this needs to cover run
// ~0.17-0.72 for saturation. Brightness is kept conservative: over-
// brightening a flat-color coat via brightness() risks blowing it out to
// white in a way desaturating doesn't - the new body art's cream front
// panel (~240/255) clips to solid white above ~1.06x, hence the 1.08
// ceiling.
//
// Both floors got tightened from an earlier, much wider pass ([0.75, 0.15])
// after a pale-skin-tone head against a dark, muted battle-scene backdrop
// came back looking washed-out gray rather than merely "toned down" -
// verified by rendering the actual filter values that combo produces
// (brightness(0.75) saturate(0.15)) against a real head asset, side by
// side with tighter candidates. Skin/hair color is a player's chosen
// identity, not something that should visibly shift toward whatever
// backdrop happened to load; the uniform's fixed navy has much more room to
// assimilate into a scene without looking "wrong". A shared, single
// tolerance still applies to both (colorMatchFilter doesn't know which
// layer is calling it), so these floors are picked to keep skin
// recognizable first, at the cost of the uniform blending in slightly less
// on the darkest/most-desaturated backdrops than the old wider range would
// have allowed.
const BRIGHTNESS_RANGE: [number, number] = [0.85, 1.08];
const SATURATION_RANGE: [number, number] = [0.55, 1.2];

/** CSS filter() value that nudges `own`'s average lightness/saturation
 * toward `target`'s (e.g. a layer toward the backdrop it sits on). Both
 * sides are precomputed offline (see visual_design/scripts/pack-assets.mjs
 * for the uniform/backdrop stats and generate-head-color-stats.mjs for the
 * DiceBear head lookup table) rather than sampled at runtime - there's no
 * canvas/image-load involved, and so no failure mode to handle here. */
export const colorMatchFilter = (own: ColorStats, target: ColorStats): string => {
  const brightness = clamp(
    own.lightness > 0 ? target.lightness / own.lightness : 1,
    ...BRIGHTNESS_RANGE,
  );
  const saturation = clamp(
    own.saturation > 0 ? target.saturation / own.saturation : 1,
    ...SATURATION_RANGE,
  );
  return `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)})`;
};
