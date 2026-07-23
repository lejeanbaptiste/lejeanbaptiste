// Every *_VARIANTS list below is a straight re-export of
// generatedAvatarParts.ts - a full scan of visual_style/*/ at pack time (see
// visual_design/scripts/generate-avatar-parts-manifest.mjs), never a
// hand-picked shortlist. Re-exported from here (rather than importing
// generatedAvatarParts directly elsewhere) so callers have one module for
// both the option shape and the choices available for each field.
export {
  EARRINGS_VARIANTS,
  EYEBROWS_VARIANTS as EYEBROW_VARIANTS,
  EYES_VARIANTS as EYE_VARIANTS,
  FEATURES_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_VARIANTS,
  MOUTH_VARIANTS,
} from './generatedAvatarParts';
import {
  EARRINGS_VARIANTS,
  EYEBROWS_VARIANTS,
  EYES_VARIANTS,
  FEATURES_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_VARIANTS,
  MOUTH_VARIANTS,
} from './generatedAvatarParts';

/** Registered in apps/desktop/src/main.ts alongside `ljb` and `ljb-asset`;
 * served by apps/desktop/src/avatarAssets.ts. */
export const AVATAR_SCHEME = 'ljb-avatar';

export interface DiceBearAvatarOptions {
  seed: string;
  /** Which uniform body art (visual_design/bodies/body*.svg's f- and m-
   * prefixed subtrees) the Service Record portrait uses - a player choice made
   * alongside head/face customization, not randomized like pose/weapon.
   * Kept on this same options object (not a separate field elsewhere) so
   * it's persisted and edited as one unit with the rest of the portrait -
   * see UniformAvatar.tsx for where it actually feeds the body compositor. */
  bodyType: 'm' | 'f';
  eyebrowsVariant: string;
  eyesVariant: string;
  mouthVariant: string;
  glassesVariant: string;
  glassesProbability: number;
  featuresVariant: string;
  featuresProbability: number;
  earringsVariant: string;
  earringsProbability: number;
  hairVariant: string;
  skinColor: string;
  hairColor: string;
}

export const createDefaultDiceBearAvatar = (seed: string): DiceBearAvatarOptions => ({
  seed: seed.trim() || 'leaf-writer',
  bodyType: 'm',
  eyebrowsVariant: 'variant01',
  eyesVariant: 'variant01',
  mouthVariant: 'variant01',
  glassesVariant: 'variant01',
  glassesProbability: 0,
  featuresVariant: FEATURES_VARIANTS[0]!,
  featuresProbability: 0,
  earringsVariant: EARRINGS_VARIANTS[0]!,
  earringsProbability: 0,
  hairVariant: 'short01',
  skinColor: 'f2d3b1',
  hairColor: '0e0e0e',
});

/** Build a deterministic Adventurer SVG URL, composited locally from the
 * bundled Adventurer layer artwork (see apps/desktop/src/avatarAssets.ts) -
 * no network access, no dependency on api.dicebear.com. `seed` isn't used
 * by the composite (there's nothing left to randomize once every layer is
 * explicit) but stays part of the interface so avatar options remain a
 * stable, cacheable identity for callers. */
export const diceBearAvatarUrl = (options: DiceBearAvatarOptions): string => {
  const params = new URLSearchParams({
    eyebrowsVariant: options.eyebrowsVariant,
    eyesVariant: options.eyesVariant,
    mouthVariant: options.mouthVariant,
    glassesVariant: options.glassesVariant,
    glassesProbability: String(options.glassesProbability),
    featuresVariant: options.featuresVariant,
    featuresProbability: String(options.featuresProbability),
    earringsVariant: options.earringsVariant,
    earringsProbability: String(options.earringsProbability),
    hairVariant: options.hairVariant,
    skinColor: options.skinColor,
    hairColor: options.hairColor,
  });
  return `${AVATAR_SCHEME}://compose?${params.toString()}`;
};

/** Deliberately labeled "M"/"F", not "Male"/"Female" or "Sex"/"Gender" -
 * this is a body-art choice (which uniform subtree renders), presented as
 * plainly as possible. */
export const BODY_TYPES: ReadonlyArray<{ label: string; value: 'm' | 'f' }> = [
  { label: 'M', value: 'm' },
  { label: 'F', value: 'f' },
];

export const SKIN_COLORS = [
  { label: 'Porcelain', value: 'f2d3b1' },
  { label: 'Honey', value: 'ecad80' },
  { label: 'Chestnut', value: '9e5622' },
  { label: 'Deep brown', value: '763900' },
];

export const HAIR_COLORS = [
  { label: 'Black', value: '0e0e0e' },
  { label: 'Blonde', value: 'e5d7a3' },
  { label: 'Brown', value: '6a4e35' },
  { label: 'Copper', value: 'cb6820' },
  { label: 'Silver', value: 'afafaf' },
];

export type AvatarCodeOptions = Omit<DiceBearAvatarOptions, 'seed'>;

/** Fixed field order for the encoded Code text - keep in sync with
 * DiceBearAvatarOptions (minus `seed`, which the composite ignores, see
 * diceBearAvatarUrl above). Order only affects the encoded array shape;
 * append fields here rather than reordering, or codes already copied out by
 * players stop decoding to what they copied. */
const AVATAR_CODE_FIELDS = [
  'bodyType',
  'eyebrowsVariant',
  'eyesVariant',
  'mouthVariant',
  'glassesVariant',
  'glassesProbability',
  'featuresVariant',
  'featuresProbability',
  'earringsVariant',
  'earringsProbability',
  'hairVariant',
  'skinColor',
  'hairColor',
] as const satisfies readonly (keyof AvatarCodeOptions)[];

const toBase64Url = (input: string): string =>
  btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (input: string): string => {
  const restored = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = restored + '='.repeat((4 - (restored.length % 4)) % 4);
  return atob(padded);
};

/** Encodes every player-visible portrait choice (all of DiceBearAvatarOptions
 * except `seed`, which is dead weight - see diceBearAvatarUrl) into one
 * copy-pasteable code, so a look can be shared or restored without touching
 * each Select in turn. Callers recompute this off the committed avatar
 * options on every change rather than storing it - it's a pure projection of
 * `options`, never a second source of truth. */
export const encodeAvatarCode = (options: DiceBearAvatarOptions): string => {
  const values = AVATAR_CODE_FIELDS.map((field) => options[field]);
  return toBase64Url(JSON.stringify(values));
};

/** Inverse of encodeAvatarCode. Returns null for anything that isn't a code
 * this build could have produced - malformed base64/JSON, wrong field count,
 * or a value outside the current variant lists (e.g. a code copied from a
 * build with a different generated-parts manifest) - so callers can fall
 * back to the last good options instead of applying a half-valid portrait. */
export const decodeAvatarCode = (code: string): AvatarCodeOptions | null => {
  let values: unknown;
  try {
    values = JSON.parse(fromBase64Url(code.trim()));
  } catch {
    return null;
  }
  if (!Array.isArray(values) || values.length !== AVATAR_CODE_FIELDS.length) return null;
  const decoded = Object.fromEntries(
    AVATAR_CODE_FIELDS.map((field, index) => [field, values[index]]),
  ) as AvatarCodeOptions;

  const isValid =
    BODY_TYPES.some((option) => option.value === decoded.bodyType) &&
    EYEBROWS_VARIANTS.includes(decoded.eyebrowsVariant) &&
    EYES_VARIANTS.includes(decoded.eyesVariant) &&
    MOUTH_VARIANTS.includes(decoded.mouthVariant) &&
    GLASSES_VARIANTS.includes(decoded.glassesVariant) &&
    (decoded.glassesProbability === 0 || decoded.glassesProbability === 100) &&
    FEATURES_VARIANTS.includes(decoded.featuresVariant) &&
    (decoded.featuresProbability === 0 || decoded.featuresProbability === 100) &&
    EARRINGS_VARIANTS.includes(decoded.earringsVariant) &&
    (decoded.earringsProbability === 0 || decoded.earringsProbability === 100) &&
    HAIR_VARIANTS.includes(decoded.hairVariant) &&
    SKIN_COLORS.some((option) => option.value === decoded.skinColor) &&
    HAIR_COLORS.some((option) => option.value === decoded.hairColor);

  return isValid ? decoded : null;
};
