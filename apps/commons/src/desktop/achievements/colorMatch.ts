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
// ~0.17-0.72 for saturation - a floor of 0.6 was leaving the muted
// backdrops almost entirely uncorrected. Brightness is kept conservative:
// over-brightening a flat-color coat via brightness() risks blowing it out
// to white in a way desaturating doesn't.
const BRIGHTNESS_RANGE: [number, number] = [0.75, 1.25];
const SATURATION_RANGE: [number, number] = [0.15, 1.2];

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
