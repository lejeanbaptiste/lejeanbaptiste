import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { colorMatchFilter, type ColorStats } from './colorMatch';
import {
  ARCHIVE_BACKGROUND_ASSETS_BY_RANK,
  WORLD_BODY_POOLS,
  type ArchiveBackgroundAsset,
} from './generatedBackgroundPools';
import {
  BODY_COLOR_STATS,
  POSE_AVAILABLE_RANK_INDICES,
  POSE_ASSET_MIN_RANK_INDEX,
  POSE_INDICES,
  WEAPON_POOLS,
  type WeaponScope,
} from './generatedBodyPools';
import { getHeadColorStats } from './headColorStats';
import { MedalIcon, type MedalMetric, type MedalTier } from './MedalIcon';

// Served at runtime by the desktop app's ljb-asset:// protocol handler
// (see apps/desktop/src/gameAssets.ts), which decrypts them from the
// bundled, encrypted resources/game-assets/assets.bin. The source artwork
// lives in the private visual_design repo, not this one.
export const GAME_ASSET_PREFIX = 'ljb-asset://';

// Served by the desktop app's ljb-body:// protocol handler (see
// apps/desktop/src/bodyAssets.ts), which composites one body/poseN SVG
// (also read from the encrypted bundle) by toggling which rank/weapon
// groups are visible - see buildBodyUrl below.
export const BODY_SCHEME_PREFIX = 'ljb-body://compose?';
/** Numeric compositor slot for the Rank 3 aircraft subject. This is kept
 * outside the reusable body namespace so body9 remains available for a
 * future normal body SVG. */
export const AIRCRAFT_SUBJECT_POSE = 9001;

type Ribbon = [string, string] | [string, string, string];

interface UniformAvatarProps {
  /** Colorways of the rank medals currently held. */
  serviceRibbons: Ribbon[];
  /** Earned medals displayed as miniatures on the uniform. */
  medals: {
    metric: MedalMetric;
    tier: MedalTier;
    label: string;
  }[];
  /** A transparent, full-canvas DiceBear Adventurer SVG URL. */
  headImageUrl: string;
  /** The composited body/pose/rank/weapon SVG URLs for the two layers the
   * head sits between - see buildBodyUrl for how callers resolve
   * pose+weapon (randomized, re-picked by the caller same as
   * backgroundImageKey) and bodyType+rank (not randomized) into each one.
   * `back` (background - rear props, a flag pole) renders behind the head,
   * `front` (middle + foreground - the uniform itself) renders in front of
   * it. */
  bodyBackImageUrl: string;
  bodyFrontImageUrl: string;
  /** ljb-asset:// key of the backdrop to show, e.g. "bg/3b" - see
   * backgroundPoolForRank/pickBackgroundKey below for how callers choose one. */
  backgroundImageKey: string;
  /** Development-only alignment overlay for tuning portrait placement. */
  showAlignmentGrid?: boolean;
  size?: number;
  /** Fires once all three layers (head, body back, body front) have either
   * loaded or failed - i.e. there's nothing left for this instance to pop
   * in piece by piece. Meant for a caller that wants to hold a spinner over
   * a portrait's first-ever reveal (see AchievementsDialog.tsx's
   * post-character-creator transition) rather than show it mid-assembly;
   * normal re-renders of an already-mounted, already-loaded instance don't
   * fire it again. */
  onReady?: () => void;
}

/** Minimum player rank index (0-based into RANK_NAMES) before a pose may
 * enter the random rotation, for *design* reasons - the art itself is
 * complete from rank 1, it's just held back for pacing. Poses not listed
 * here have no design-driven floor. Combined with POSE_ASSET_MIN_RANK_INDEX
 * (generatedBodyPools.ts - a *hard* floor for poses whose art genuinely
 * doesn't exist below some rank, e.g. a subject scene) by effectivePoseMinRankIndex
 * below; the two are independent and this one alone is never sufficient to
 * know when a pose can first appear. */
const POSE_MIN_RANK_INDEX: Partial<Record<number, number>> = {
  3: 2, // body3.svg — rank 3 (Caporal) and above
  4: 2, // body4.svg — rank 3 (Caporal) and above
};

const effectivePoseMinRankIndex = (poseIndex: number): number =>
  Math.max(POSE_ASSET_MIN_RANK_INDEX[poseIndex] ?? -1, POSE_MIN_RANK_INDEX[poseIndex] ?? -1);

/** Filter applied to the complete scene for the deliberately photographic
 * WWI pose. Keep this as a shared value so the live avatar and certificate
 * export render the same treatment. */
export const scenePhotoFilterForPose = (): string | undefined => undefined;

/**
 * Archive treatment belongs to the selected record, rather than the pose:
 * a later player can still encounter an older WWI image, and a Rank 4 image
 * may deliberately be sepia or hand-coloured. CSS is the runtime baseline;
 * the private QA browser provides the more faithful grain and film response
 * used to review source material.
 */
export const scenePhotoFilterForBackground = (backgroundImageKey: string): string | undefined => {
  const treatment =
    ARCHIVE_BACKGROUND_ASSETS_BY_RANK.flat().find((asset) => asset.assetKey === backgroundImageKey)
      ?.treatment ?? 'colour';
  switch (treatment) {
    case 'wwi-ortho':
      return 'grayscale(1) contrast(1.08) brightness(0.98)';
    case 'wwii-bw':
      return 'grayscale(1) contrast(1.08) brightness(0.98)';
    case 'sepia':
      return 'grayscale(1) sepia(0.78) saturate(0.78) contrast(1.10) brightness(0.96)';
    case 'tinted':
      return 'grayscale(1) sepia(0.24) saturate(0.72) contrast(1.05) brightness(0.98)';
    case 'hand-coloured':
      return 'contrast(1.03) saturate(0.92)';
    default:
      return undefined;
  }
};

/** True when this pose may appear in the random rotation at `rankIndex`.
 * Some poses have a minimum rank (see effectivePoseMinRankIndex). Poses with
 * weapon art also require at least one weapon tier unlocked at the player's
 * rank - the same cumulative rule as pickWeapon below (e.g. body7.svg only
 * has weapons from rank 2 up, so it stays out of rotation for rank 1 and
 * below). Unarmed poses with no minimum rank are always eligible. */
export const poseEligibleForRank = (
  poseIndex: number,
  bodyType: 'm' | 'f',
  rankIndex: number,
): boolean => {
  const explicitRanks = POSE_AVAILABLE_RANK_INDICES[poseIndex];
  if (explicitRanks && !explicitRanks.includes(rankIndex)) return false;
  const minRankIndex = effectivePoseMinRankIndex(poseIndex);
  if (rankIndex < minRankIndex) return false;

  const channels = WEAPON_POOLS[poseIndex] ?? [];
  // Some source SVGs retain an empty `weapons` group as an editing
  // placeholder (body5 is one). It is an unarmed pose, not a pose waiting
  // for a weapon tier, so only channels that actually declare a rank should
  // trigger weapon-gating.
  if (!channels.some((channel) => Object.keys(channel).length > 0)) return true;
  for (const channel of channels) {
    for (const rank of Object.keys(channel).map(Number)) {
      if (rank <= rankIndex + 1 && channelHasRankFor(channel, rank, bodyType)) return true;
    }
  }
  return false;
};

/** Every pose eligible for random pick at this rank and body type. */
export const eligiblePoseIndices = (bodyType: 'm' | 'f', rankIndex: number): number[] =>
  POSE_INDICES.filter((pose) => {
    const allowedByWorld = WORLD_BODY_POOLS[Math.max(0, rankIndex)];
    return (
      (allowedByWorld === null || allowedByWorld === undefined || allowedByWorld.includes(pose)) &&
      poseEligibleForRank(pose, bodyType, rankIndex)
    );
  });

/** Uniform random pick among every pose that has a full rank kit (see
 * POSE_INDICES in generatedBodyPools.ts, auto-discovered at pack time) and
 * is eligible at the player's rank (see poseEligibleForRank above),
 * excluding `previousPose` when there's more than one option - same
 * no-repeat-in-a-row behavior as pickBackgroundKey below. Pose is genuinely
 * random per render, never persisted, per Daniel's "pose and weapons will be
 * random". */
export const pickPose = (
  previousPose: number | null,
  bodyType: 'm' | 'f',
  rankIndex: number,
): number => {
  const eligible = eligiblePoseIndices(bodyType, rankIndex);
  const choices =
    previousPose !== null && eligible.length > 1
      ? eligible.filter((pose) => pose !== previousPose)
      : eligible;
  return choices[Math.floor(Math.random() * choices.length)]!;
};

/** One resolved weapon pick for a pose: the weapon-rank tier that was
 * chosen (for display only) and the full list of image ids to show -
 * everything every weapon "channel" has at that rank (a pose can have 0, 1,
 * or 2 channels; see WEAPON_POOLS's own doc comment in generatedBodyPools.ts
 * for why - body6.svg's rear/front split vs body7.svg's single group), and
 * within a channel possibly more than one id (simultaneous parts of the
 * same weapon, not alternates - see pickWeapon below). */
export interface WeaponSelection {
  rank: number;
  imageIds: string[];
}

/** True if a scope (universal, or one bodyType) has any group with any
 * variant to show. See WeaponScope's doc comment in generatedBodyPools.ts. */
const scopeHasArt = (scope: WeaponScope | undefined): boolean =>
  !!scope && Object.values(scope).some((variants) => Object.keys(variants).length > 0);

/** True if this rank has anything at all to show for `bodyType` in this
 * channel - either a universal (sex-independent) piece, or a bodyType-
 * specific piece. Shared by poseEligibleForRank and pickWeapon below. */
const channelHasRankFor = (
  channel: (typeof WEAPON_POOLS)[number][number],
  rank: number,
  bodyType: 'm' | 'f',
): boolean => {
  const entry = channel[rank];
  if (!entry) return false;
  return scopeHasArt(entry.universal) || scopeHasArt(entry[bodyType]);
};

/** Every group name a scope declares (empty set if the scope is absent). */
const groupsOf = (scope: WeaponScope | undefined): Set<string> => new Set(Object.keys(scope ?? {}));

/** Every variant key one group of a scope declares (empty set if the scope
 * or that group is absent). */
const variantKeysOf = (scope: WeaponScope | undefined, group: string): Set<string> =>
  new Set(Object.keys(scope?.[group] ?? {}));

/** Daniel's rule: "at that rank or above, that weapon asset enters
 * rotation... rank 5 will cycle randomly through rank 1-5 assets" - the
 * exact same cumulative-pool random pick as backgroundPoolForRank/
 * pickBackgroundKey, just over weapon-rank tiers instead of backdrop
 * letters. Returns null when this pose has no weapon at all, or the
 * player's rank hasn't unlocked any tier yet.
 *
 * `requireRank`, when given, drops every tier below it from the pool first
 * (e.g. the Rank 5+ sci-fi backdrop shouldn't pair with a Napoleonic-era
 * rank-1/2 musket) - falls back to the unrestricted cumulative pool if that
 * would empty it out entirely, so a portrait still shows *something*.
 *
 * A weapon can split into independent equipment groups (body7.svg's
 * "pistol" and "sword" - a sidearm and a melee weapon worn together, not
 * alternatives; most poses only ever use the single default group ''). Every
 * group present at this rank is included at once, but each cycles its own
 * variant selection independently - which sword shows doesn't constrain
 * which pistol shows.
 *
 * Within one group, some ranks have several mutually-exclusive designs
 * (body6.svg's napoleonic1 vs napoleonic2 vs napoleonic3 in the default
 * group - three different muskets, not three pieces of one; body7.svg's
 * napoleonic-sword1 vs napoleonic-sword2 in the "sword" group) - exactly
 * one variant is picked per group, from either the universal or the
 * bodyType-specific scope (a pose only ever uses one of the two for a given
 * group). That pick is made *once* per group, shared across every channel
 * (not independently per channel), and only from variant keys common to
 * every channel that declares any for that group - picking independently
 * per channel could combine a front half authored for variant "1" with a
 * rear half only drawn for variant "2" (body6.svg's rank4/rank5 are
 * asymmetric like this: not every variant has a matching piece in both the
 * background and foreground weapon groups). Falls back to the union across
 * channels only if they share no variant at all, so a rank with genuinely
 * disjoint per-channel authoring still shows *something* rather than
 * nothing. */
export const pickWeapon = (
  poseIndex: number,
  bodyType: 'm' | 'f',
  rankIndex: number,
  previousRank: number | null,
  requireRank?: number,
  maxRank?: number,
): WeaponSelection | null => {
  const channels = WEAPON_POOLS[poseIndex] ?? [];
  if (channels.length === 0) return null;

  const unlockedRanks = new Set<number>();
  for (const channel of channels) {
    for (const rank of Object.keys(channel).map(Number)) {
      if (rank <= rankIndex + 1 && channelHasRankFor(channel, rank, bodyType))
        unlockedRanks.add(rank);
    }
  }
  if (unlockedRanks.size === 0) return null;

  let restricted = unlockedRanks;
  if (requireRank !== undefined) {
    restricted = new Set(Array.from(restricted).filter((rank) => rank >= requireRank));
  }
  if (maxRank !== undefined) {
    restricted = new Set(Array.from(restricted).filter((rank) => rank <= maxRank));
  }
  const pool = Array.from(restricted.size > 0 ? restricted : unlockedRanks);
  const choices =
    previousRank !== null && pool.length > 1 ? pool.filter((rank) => rank !== previousRank) : pool;
  const rank = choices[Math.floor(Math.random() * choices.length)]!;

  // Every group present at this rank, across channels and both scopes.
  const groupNames = new Set<string>();
  for (const channel of channels) {
    const entry = channel[rank];
    if (!entry) continue;
    for (const group of groupsOf(entry.universal)) groupNames.add(group);
    for (const group of groupsOf(entry[bodyType])) groupNames.add(group);
  }

  const imageIds: string[] = [];
  for (const group of groupNames) {
    // Variant keys for THIS group, per channel (universal ∪ bodyType-
    // specific) - same intersection-then-union-fallback consistency rule
    // described above, scoped to this one group.
    const variantKeySetsPerChannel = channels
      .map((channel) => channel[rank])
      .filter((entry): entry is (typeof WEAPON_POOLS)[number][number][number] => !!entry)
      .map(
        (entry) =>
          new Set([
            ...variantKeysOf(entry.universal, group),
            ...variantKeysOf(entry[bodyType], group),
          ]),
      )
      .filter((keys) => keys.size > 0);
    if (variantKeySetsPerChannel.length === 0) continue;

    const intersection = variantKeySetsPerChannel.reduce(
      (acc, keys) => new Set(Array.from(acc).filter((key) => keys.has(key))),
    );
    const union = new Set(variantKeySetsPerChannel.flatMap((keys) => Array.from(keys)));
    const candidates = Array.from(intersection.size > 0 ? intersection : union);
    const variant = candidates[Math.floor(Math.random() * candidates.length)]!;

    // Every id sharing this group+variant within a channel is a
    // simultaneous part of the same design (e.g. bodies/body7.svg's sword
    // sits one image per hand), so all of them come along together.
    for (const channel of channels) {
      const entry = channel[rank];
      if (!entry) continue;
      for (const scope of [entry.universal, entry[bodyType]]) {
        const ids = scope?.[group]?.[variant];
        if (ids) imageIds.push(...ids);
      }
    }
  }
  return { rank, imageIds };
};

/** Builds the ljb-body:// URL for one resolved portrait's `back` or `front`
 * layer: a fixed pose + bodyType + rank, plus whichever specific weapon
 * image ids (if any) were already resolved by pickWeapon - see
 * bodyAssets.ts's composeBodySvg for how these get turned into
 * display:none/inline toggles on the pose SVG. Call this twice, once per
 * layer (see UniformAvatar's bodyBackImageUrl/bodyFrontImageUrl props) -
 * `back` is the pose's `background` group (rear props, a flag pole) meant
 * to sit behind the head, `front` is `middle` + `foreground` (the uniform
 * itself) meant to sit in front of it. */
export const buildBodyUrl = (
  poseIndex: number,
  bodyType: 'm' | 'f',
  rankIndex: number,
  weapon: WeaponSelection | null,
  layer: 'back' | 'front',
): string => {
  const params = new URLSearchParams({
    pose: String(poseIndex),
    bodyType,
    rank: String(Math.max(0, Math.min(6, rankIndex)) + 1),
    layer,
  });
  if (weapon && weapon.imageIds.length > 0) params.set('weaponIds', weapon.imageIds.join(','));
  if (poseIndex === AIRCRAFT_SUBJECT_POSE) {
    // The aircraft is a Rank 3-only composite subject. Keep both layers on the same
    // embedded environment, changing it as the resolved weapon/rank changes
    // without adding a second piece of persisted portrait state.
    const environment = ((Math.max(0, rankIndex) + 1 + (weapon?.rank ?? 0)) % 4) + 1;
    params.set('subjectBackground', String(environment));
  }
  return `${BODY_SCHEME_PREFIX}${params.toString()}`;
};

// Every rank is one world. Earlier worlds remain in the archive as history,
// while the current world's military records are selected more often. Pools
// are generated from assets/worlds.json and final artwork by pack-assets.mjs.

/** Every backdrop unlocked at or below `rankIndex` (-1/unranked still gets
 * the rank-1 pool, so there is always something to show). Subject scenes
 * keep their embedded environments inside the body SVG; the external archive
 * remains the ordinary backdrop pool for all poses.
 */
export const backgroundPoolForRank = (
  rankIndex: number,
  poseIndex?: number,
  ribbonsIntoRank: number = RANK_4_GROUPS.length,
): string[] => {
  const cumulative = ARCHIVE_BACKGROUND_ASSETS_BY_RANK.slice(0, Math.max(0, rankIndex) + 1).flat();
  const compatible = cumulative.filter(
    (asset) =>
      !excludesPose(asset, poseIndex) && !isLockedRank4Group(asset, rankIndex, ribbonsIntoRank),
  );
  return (compatible.length > 0 ? compatible : cumulative).map((asset) => asset.assetKey);
};

/** True when docs/bg-body-pairs.md (see pack-assets.mjs's parseBgBodyPairs)
 * flags this backdrop as compositionally wrong for this pose - a lamppost
 * through the head, a pose facing the wrong way for the scene, etc. */
const excludesPose = (asset: ArchiveBackgroundAsset, poseIndex?: number): boolean =>
  poseIndex !== undefined && asset.excludedPoses?.includes(poseIndex) === true;

// Rank 4 (index 3) is being rolled out gradually: its background pool is
// split into five named groups by filename (r04-a-.. through r04-e-..),
// and only `a` is available the moment the player reaches Rank 4 - each
// ribbon earned since then (see AchievementsDialog.tsx's ribbonsIntoRank)
// opens the next group, until all five are open with two ribbons still to
// spare before promotion to Rank 5. Only restricts Rank 4's own pool, and
// only while the player is actually AT Rank 4 - a Rank 4 asset appearing in
// some later rank's "historical" pool is never restricted, since finishing
// Rank 4 necessarily means every group was already open by then. Unrelated
// to any other rank, and to excludesPose's per-pose exclusions above -
// in-game only, deliberately not mirrored in the QA browser.
const RANK_4_INDEX = 3;
const RANK_4_GROUPS = ['a', 'b', 'c', 'd', 'e'];
const rank4Group = (asset: ArchiveBackgroundAsset): string | null => {
  const filename = asset.assetKey.split('/').pop() ?? '';
  return /^r04-([a-e])-/.exec(filename)?.[1] ?? null;
};
const isLockedRank4Group = (
  asset: ArchiveBackgroundAsset,
  rankIndex: number,
  ribbonsIntoRank: number,
): boolean => {
  if (rankIndex !== RANK_4_INDEX) return false;
  const group = rank4Group(asset);
  if (!group) return false;
  const unlockedCount = Math.min(RANK_4_GROUPS.length, ribbonsIntoRank + 1);
  return RANK_4_GROUPS.indexOf(group) >= unlockedCount;
};

const CURRENT_WORLD_PROBABILITY = 0.8;

// Easter eggs (e.g. rank 2's castle/dinosaurs/dragon/knights/kraken/mars/
// robot/undersea) are ordinary backdrops in the rotation, just weighted
// very low (0.05 vs 1 in assets/worlds.json) so weightedPick surfaces them
// rarely - not a separate trigger. 'memory' isn't wired in: no world
// currently declares any memory-category asset.
const isSelectableCategory = (asset: ArchiveBackgroundAsset): boolean =>
  asset.category === 'military' || asset.category === 'easter-egg';

const selectableBackgroundsForRank = (rankIndex: number, ribbonsIntoRank: number) =>
  (ARCHIVE_BACKGROUND_ASSETS_BY_RANK[Math.max(0, rankIndex)] ?? []).filter(
    (asset) =>
      isSelectableCategory(asset) && !isLockedRank4Group(asset, rankIndex, ribbonsIntoRank),
  );

const weightedPick = <T extends { weight: number }>(assets: readonly T[]): T => {
  const total = assets.reduce((sum, asset) => sum + asset.weight, 0);
  let needle = Math.random() * total;
  for (const asset of assets) {
    needle -= asset.weight;
    if (needle <= 0) return asset;
  }
  return assets[assets.length - 1]!;
};

/** Picks a random backdrop from the unlocked pool, excluding whichever key
 * was shown last (when the pool has more than one option) so the same
 * image never appears twice in a row. `ribbonsIntoRank` (ribbons earned
 * since entering `rankIndex`, i.e. totalRibbonsEarned % RIBBONS_PER_OVERALL_RANK
 * - see AchievementsDialog.tsx) only matters for Rank 4's group rollout;
 * pass 0 (or omit) for any other rank. */
export const pickBackgroundKey = (
  rankIndex: number,
  previousKey: string | null,
  poseIndex?: number,
  ribbonsIntoRank = 0,
): string => {
  const current = selectableBackgroundsForRank(rankIndex, ribbonsIntoRank);
  const historical = ARCHIVE_BACKGROUND_ASSETS_BY_RANK.slice(0, Math.max(0, rankIndex)).flatMap(
    (assets) => assets.filter(isSelectableCategory),
  );
  const preferred =
    current.length > 0 && historical.length > 0 && Math.random() < CURRENT_WORLD_PROBABILITY
      ? current
      : current.length > 0 && historical.length === 0
        ? current
        : historical;
  // Drop backdrops docs/bg-body-pairs.md flags as compositionally wrong for
  // this pose - falling back to the unfiltered pool if that would empty it
  // out entirely (a slightly-off composite still beats no portrait at all).
  const compatible = preferred.filter((asset) => !excludesPose(asset, poseIndex));
  const pool = compatible.length > 0 ? compatible : preferred;
  const choices =
    previousKey && pool.length > 1 ? pool.filter((asset) => asset.assetKey !== previousKey) : pool;
  return weightedPick(choices).assetKey;
};

/** The 1-based rank a backdrop belongs to (its own declared `rank`, not the
 * bucket it happened to surface in via pickBackgroundKey's historical/
 * current split), or null if `key` isn't a recognised archive asset. Lets
 * callers tell a Rank 5+ sci-fi backdrop apart from an earlier-rank
 * "historical" pick without re-deriving the bucket search themselves - see
 * pickWeapon's `requireRank`. */
export const rankOfBackgroundKey = (key: string): number | null => {
  for (const assets of ARCHIVE_BACKGROUND_ASSETS_BY_RANK) {
    const found = assets.find((asset) => asset.assetKey === key);
    if (found) return found.rank;
  }
  return null;
};

/** The weapon tier that counts as "modern era". Also the highest tier any
 * pose actually has art for: backdrops run to Rank 7, weapon art stops
 * here. */
export const MODERN_ERA_RANK = 5;

/** Maps a backdrop's world rank to the weapon tier that era uses. Weapon art
 * is labeled by era name (napoleonic/wwi/wwii/22c), not by world rank -
 * see WEAPON_ERA_TIERS in visual_design/scripts/bodySvg.mjs. Ranks 1 and 2
 * both share napoleonic (tier 1); there is no tier 2 at all. */
export const weaponTierForBackgroundRank = (backgroundRank: number): number => {
  if (backgroundRank >= MODERN_ERA_RANK) return MODERN_ERA_RANK;
  if (backgroundRank <= 2) return 1;
  return backgroundRank;
};

/** Floor/ceiling weapon tiers to pair with `backgroundKey` - the rule that
 * keeps a portrait's weapon in the same era as its backdrop.
 *
 * Ranks 5, 6 and 7 all floor at MODERN_ERA_RANK: those backdrops are
 * modern/sci-fi, but only tier 5 weapon art exists, so all three share it
 * (Daniel: "for now, ranks 5-7 should all use rank5 weapons"). Passing the
 * backdrop's own rank instead would ask pickWeapon for a tier-6 floor,
 * empty its pool, and trigger the unrestricted fallback - which is how a
 * Rank 6 desert backdrop ended up holding a flintlock. The floor is
 * cumulative, so tier 6/7 art would be picked up on its own if it ever
 * lands (UniformAvatar.test.ts fails when it does, as a reminder to raise
 * MODERN_ERA_RANK).
 *
 * Earlier-rank backdrops lock to the weapon tier for that era (via
 * weaponTierForBackgroundRank): a Rank 3 WWI scene gets tier-3 weapons
 * only; Rank 1 and Rank 2 both get tier-1 napoleonic weapons — there is
 * no tier 2, so using the backdrop rank directly would empty the pool and
 * silently fall back to WWI/sci-fi gear on a Napoleonic scene. */
export interface WeaponRankBounds {
  ceiling?: number;
  floor?: number;
}

export const weaponRankBoundsForBackground = (backgroundKey: string): WeaponRankBounds => {
  const backgroundRank = rankOfBackgroundKey(backgroundKey);
  if (backgroundRank === null) return {};
  const tier = weaponTierForBackgroundRank(backgroundRank);
  if (backgroundRank >= MODERN_ERA_RANK) return { floor: tier };
  return { ceiling: tier, floor: tier };
};

/** @deprecated Prefer weaponRankBoundsForBackground — kept for tests. */
export const weaponFloorForBackground = (backgroundKey: string): number | undefined =>
  weaponRankBoundsForBackground(backgroundKey).floor;

// bg_* artwork is 758x331.
export const BG_ASPECT = 758 / 331;

export const NEUTRAL_STATS: ColorStats = { lightness: 0.5, saturation: 0 };

// The 7 uniforms and 22 backdrops are a fixed set of static assets with
// stats precomputed at pack time (see pack-assets.mjs) - fetched once per
// key over IPC and reused for the life of the renderer. No canvas or image
// load is involved, unlike sampling these at runtime would require.
const colorStatsCache = new Map<string, Promise<ColorStats>>();
export const getCachedColorStats = (key: string): Promise<ColorStats> => {
  let cached = colorStatsCache.get(key);
  if (!cached) {
    cached = (window.electronAPI?.getGameAssetColorStats?.(key) ?? Promise.resolve(null)).then(
      (stats) => stats ?? NEUTRAL_STATS,
      () => NEUTRAL_STATS,
    );
    colorStatsCache.set(key, cached);
  }
  return cached;
};

// Body, head, and background art are now all drawn on one identically
// sized/ratioed canvas (visual_design/bodies/body*.svg, heads_positionned.svg,
// and rewards/bg_*.png are all 200.55417 x 87.57708mm - see BG_ASPECT below),
// deliberately so no separate coat-box/head-box coordinate systems are
// needed anymore: background and body are both simple full-frame layers.

// The DiceBear Adventurer SVG has a 762x762 content canvas. Some hair
// variants (e.g. long18) draw strands outside it, so the local compositor
// (apps/desktop/src/avatarAssets.ts) bakes a content-sized pad on every
// side directly into the fetched SVG - it always arrives pre-padded, wide
// enough that nothing can clip regardless of how far a layer overflows.
export const SVG_PAD = 762;
export const SVG_VIEWBOX_SIZE = 762;
export const PADDED_VIEWBOX_SIZE = SVG_VIEWBOX_SIZE + SVG_PAD * 2;

// The shared canvas's own dimensions (see BG_ASPECT below), in the same
// units Daniel measured the head registration in.
const SHARED_CANVAS_WIDTH = 200.55417;
const SHARED_CANVAS_HEIGHT = 87.57708;

// Head placement, derived from heads_positionned.svg's `head` group
// transform - `matrix(0.04382162,0,0,0.04382162,84.087754,11.470164)` -
// which Daniel measured against the *unpadded* 0-762 visual_style content.
// avatarAssets.ts's fetched SVG is padded (see SVG_PAD/PADDED_VIEWBOX_SIZE
// above), so the translate component here is that matrix's own e/f shifted
// by -(scale * SVG_PAD) to account for the pad before placing it on the
// shared canvas - verified by rendering both side by side and diffing
// (matched pixel-for-pixel bar antialiasing noise). Uniform scale (no
// rotation/skew in the source matrix), so the padded composite always
// renders as a square; expressed here as independent width/height frame
// fractions since the shared canvas's own aspect ratio is only
// approximately equal to BG_ASPECT (200.55417/87.57708 vs 758/331 - a
// ~0.01% difference from Daniel's mm measurements, imperceptible).
const HEAD_MATRIX_SCALE = 0.04382162;
const HEAD_MATRIX_E = 84.087754;
const HEAD_MATRIX_F = 11.470164;
const HEAD_UNPADDED_LEFT = HEAD_MATRIX_E - HEAD_MATRIX_SCALE * SVG_PAD;
const HEAD_UNPADDED_TOP = HEAD_MATRIX_F - HEAD_MATRIX_SCALE * SVG_PAD;
const HEAD_RENDERED_SIZE = PADDED_VIEWBOX_SIZE * HEAD_MATRIX_SCALE;
export const HEAD_LEFT_FRAC = HEAD_UNPADDED_LEFT / SHARED_CANVAS_WIDTH;
export const HEAD_TOP_FRAC = HEAD_UNPADDED_TOP / SHARED_CANVAS_HEIGHT;
export const HEAD_WIDTH_FRAC = HEAD_RENDERED_SIZE / SHARED_CANVAS_WIDTH;
export const HEAD_HEIGHT_FRAC = HEAD_RENDERED_SIZE / SHARED_CANVAS_HEIGHT;

// Where the actually-visible face content sits *within* the padded square
// above - measured from the unpadded SVG's own rendered bounding box (the
// same measurement the old HEAD_CONTENT constant used, before the
// registration rework made the full padded box unnecessary for placing the
// real head image). Used only for sizing the "avatar unavailable" fallback
// below to roughly where a face would be, instead of the full padded
// square - the padded square is mostly transparent margin, so sizing the
// fallback to it renders as a jarring oversized blank shape.
const HEAD_CONTENT_FRACTION_OF_SQUARE = {
  height: 472.9 / PADDED_VIEWBOX_SIZE,
  left: (141.4 + SVG_PAD) / PADDED_VIEWBOX_SIZE,
  top: (138.1 + SVG_PAD) / PADDED_VIEWBOX_SIZE,
  width: 502.5 / PADDED_VIEWBOX_SIZE,
};
export const HEAD_FALLBACK_LEFT_FRAC =
  HEAD_LEFT_FRAC + HEAD_CONTENT_FRACTION_OF_SQUARE.left * HEAD_WIDTH_FRAC;
export const HEAD_FALLBACK_TOP_FRAC =
  HEAD_TOP_FRAC + HEAD_CONTENT_FRACTION_OF_SQUARE.top * HEAD_HEIGHT_FRAC;
export const HEAD_FALLBACK_WIDTH_FRAC = HEAD_CONTENT_FRACTION_OF_SQUARE.width * HEAD_WIDTH_FRAC;
export const HEAD_FALLBACK_HEIGHT_FRAC = HEAD_CONTENT_FRACTION_OF_SQUARE.height * HEAD_HEIGHT_FRAC;

// Single source of truth for every layer's stacking order - every sibling
// in the portrait stack needs an explicit entry here, not just the ones
// that happen to overlap today. Mixing explicit z-index values with
// z-index:auto siblings is exactly what broke DecorationRack (medals sat at
// the implicit auto/0 level, which paints *below* any sibling given a real
// z-index) the moment head/body got explicit values for the head-behind-
// body reorder - auto doesn't compete with a real z-index by DOM order,
// it just loses.
const PORTRAIT_Z_INDEX = {
  bodyBack: 0,
  head: 1,
  bodyFront: 2,
  decorationRack: 3,
  devGrid: 4,
} as const;

// The empty chest panel to the right of the button line, as a fraction of
// the full portrait frame (body art is full-frame now, so this is no longer
// relative to a separate coat sub-box). Measured the same way the old value
// was - masking bodies/body1.svg's navy color at rank 4 and rank 7 (to make
// sure the rank-7 sash doesn't cut into it) for both bodyType m and f, and
// intersecting - largest clear rect came out to left=0.483, top=0.525,
// width=0.082, height=0.230 (in 1800x787 renders); the values below inset
// that by a small safety margin so the rack doesn't touch the button line,
// collar, or sash exactly at the edge.
export const DECORATION_PANEL = { height: 0.19, left: 0.49, top: 0.53, width: 0.07 };

// The decoration panel's own border/stroke color (ribbon rack, medal rack)
// - reused for the portrait frame border too, so the frame reads as part
// of the same panel rather than a separate light/dark-mode outline.
export const PANEL_BORDER_COLOR = 'rgba(24, 35, 52, .75)';

/** Choose a rows x columns grid that packs `count` items of the given
 * width:height aspect ratio into a box as large as possible, trying every
 * row count and keeping whichever is limited least by the box's width or
 * height (i.e. the one with the biggest resulting item size). */
export const packGrid = (count: number, boxWidth: number, boxHeight: number, aspect: number) => {
  let best = { cols: count, itemHeight: 0, rows: 1 };
  for (let rows = 1; rows <= count; rows += 1) {
    const cols = Math.ceil(count / rows);
    const itemHeight = Math.min(boxWidth / cols / aspect, boxHeight / rows);
    if (itemHeight > best.itemHeight) best = { cols, itemHeight, rows };
  }
  return best;
};

// MedalIcon's viewBox is 26x46 (see MedalIcon.tsx): width:height aspect.
export const MEDAL_ASPECT = 26 / 46;
export const RIBBON_ASPECT = 18 / 7;
// Fraction of the panel's height reserved for the ribbon rack before medals
// get the rest; ribbons are relatively few (max 9) and wide, so they don't
// need much vertical room.
export const RIBBON_BAND_FRACTION = 0.22;

// packGrid always maximizes item size to fill the box, which looks right at
// a realistic rack density but blows a single early medal up to fill the
// whole panel. Flooring the count it packs against to a plausible
// early-service size (a handful of medals) keeps icons a sane size until
// there are actually enough to fill the rack.
export const MEDAL_COUNT_FLOOR = 6;

// Ribbons are sized against this fixed count always (never the player's
// actual ribbon count) so a real service ribbon stays a small, constant,
// "barely visible" size on the coat regardless of how many are earned -
// real ribbon racks don't get physically bigger stripes with seniority.
// Extra ribbons beyond this just wrap onto more rows at the same size.
export const RIBBON_COUNT_FLOOR = 5;

const RibbonRack = ({
  itemHeight,
  cols,
  ribbons,
}: {
  itemHeight: number;
  cols: number;
  ribbons: Ribbon[];
}) => (
  <div
    aria-hidden="true"
    style={{
      display: 'grid',
      gap: 0,
      gridTemplateColumns: `repeat(${cols}, ${itemHeight * RIBBON_ASPECT}px)`,
      justifyContent: 'center',
    }}
  >
    {ribbons.map((ribbon, index) => {
      const stripes = ribbon.length === 3 ? ribbon : [ribbon[0], ribbon[1], ribbon[0]];
      return (
        <div
          key={index}
          style={{
            background: `linear-gradient(90deg, ${stripes[0]} 0 33%, ${stripes[1]} 33% 66%, ${stripes[2]} 66%)`,
            border: `1px solid ${PANEL_BORDER_COLOR}`,
            height: itemHeight,
            width: itemHeight * RIBBON_ASPECT,
          }}
        />
      );
    })}
  </div>
);

const MedalRack = ({
  itemHeight,
  cols,
  medals,
}: {
  itemHeight: number;
  cols: number;
  medals: UniformAvatarProps['medals'];
}) => (
  <div
    aria-label={`${medals.length} earned medals`}
    style={{
      display: 'grid',
      gap: 0,
      gridTemplateColumns: `repeat(${cols}, ${itemHeight * MEDAL_ASPECT}px)`,
      justifyContent: 'center',
    }}
  >
    {medals.map((medal) => (
      <div key={medal.label} title={medal.label}>
        <MedalIcon metric={medal.metric} size={itemHeight} tier={medal.tier} />
      </div>
    ))}
  </div>
);

/** Ribbons (service-rank stripes) stacked directly above earned-medal
 * miniatures within DECORATION_PANEL - the coat's actual empty chest area -
 * rather than positioned by eye. Ribbons are a fixed, realistic size
 * (see RIBBON_COUNT_FLOOR); medals are packed as large as they can go. */
const DecorationRack = ({
  coatHeight,
  coatTop,
  coatWidth,
  ribbons,
  medals,
}: {
  coatHeight: number;
  coatTop: number;
  coatWidth: number;
  ribbons: Ribbon[];
  medals: UniformAvatarProps['medals'];
}) => {
  const panelWidth = coatWidth * DECORATION_PANEL.width;
  const panelHeight = coatHeight * DECORATION_PANEL.height;
  const ribbonBoxHeight = ribbons.length > 0 ? panelHeight * RIBBON_BAND_FRACTION : 0;
  const medalBoxHeight = panelHeight - ribbonBoxHeight;
  // Always packed against the fixed floor, never the player's actual ribbon
  // count - see RIBBON_COUNT_FLOOR. Extra ribbons beyond it wrap onto more
  // rows at this same size instead of shrinking every ribbon to fit.
  const ribbonGrid = packGrid(RIBBON_COUNT_FLOOR, panelWidth, ribbonBoxHeight, RIBBON_ASPECT);
  const medalGrid = packGrid(
    Math.max(medals.length, MEDAL_COUNT_FLOOR),
    panelWidth,
    medalBoxHeight,
    MEDAL_ASPECT,
  );
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        height: panelHeight,
        justifyContent: 'center',
        left: coatWidth * DECORATION_PANEL.left,
        position: 'absolute',
        // The panel's own top/left are fractions of the coat image, which
        // itself starts at coatTop (not 0) within the portrait frame.
        top: coatTop + coatHeight * DECORATION_PANEL.top,
        width: panelWidth,
        zIndex: PORTRAIT_Z_INDEX.decorationRack,
      }}
    >
      {ribbons.length > 0 && (
        <RibbonRack cols={ribbonGrid.cols} itemHeight={ribbonGrid.itemHeight} ribbons={ribbons} />
      )}
      <MedalRack cols={medalGrid.cols} itemHeight={medalGrid.itemHeight} medals={medals} />
    </div>
  );
};

/**
 * Head/body SVGs are fetched from protocol handlers and shown as `<img>`
 * blobs. Before blobifying we stamp explicit pixel `width`/`height` on the
 * root `<svg>` so Chromium rasterizes densely (thin vector strokes otherwise
 * look jagged). Body layers are also laid out at BODY_CSS_OVERSAMPLE × the
 * portrait box, then scaled back in CSS for a sharper intermediate bitmap.
 * Source art is left untouched.
 */
export const BODY_CSS_OVERSAMPLE = 2;

/** Extra intrinsic SVG pixels per CSS pixel of the `<img>` box (HiDPI stamp). */
export const SVG_PIXEL_OVERSAMPLE = 2;

/** Replace root `<svg>` width/height with pixel sizes so `<img>` rasterizes densely. */
export const stampSvgPixelSize = (svgText: string, widthPx: number, heightPx: number): string => {
  const width = Math.max(1, Math.round(widthPx));
  const height = Math.max(1, Math.round(heightPx));
  return svgText.replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    const cleaned = String(attrs)
      .replace(/\swidth=(["'])[\s\S]*?\1/g, '')
      .replace(/\sheight=(["'])[\s\S]*?\1/g, '');
    return `<svg width="${width}" height="${height}"${cleaned}>`;
  });
};

const devicePixelRatioOr1 = (): number =>
  typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;

/** Intrinsic SVG pixel size for an `<img>` whose CSS box is `cssWidth`×`cssHeight`. */
export const svgStampPixelsForCssBox = (
  cssWidth: number,
  cssHeight: number,
): { width: number; height: number } => {
  const scale = SVG_PIXEL_OVERSAMPLE * devicePixelRatioOr1();
  return { width: cssWidth * scale, height: cssHeight * scale };
};

function useComposedSvgSrc(
  url: string,
  stampWidthPx: number,
  stampHeightPx: number,
): { failed: boolean; src: string | null } {
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  useEffect(() => setFailed(false), [url]);
  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    void fetch(url)
      .then((response) => response.text())
      .then((svgText) => {
        if (cancelled) return;
        const stamped = stampSvgPixelSize(svgText, stampWidthPx, stampHeightPx);
        const blob = new Blob([stamped], { type: 'image/svg+xml' });
        const objectUrl = URL.createObjectURL(blob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = objectUrl;
        setSrc(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url, stampWidthPx, stampHeightPx]);
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );
  return { failed, src };
}

export const UniformAvatar = ({
  serviceRibbons,
  medals,
  headImageUrl,
  bodyBackImageUrl,
  bodyFrontImageUrl,
  backgroundImageKey,
  showAlignmentGrid = false,
  size = 96,
  onReady,
}: UniformAvatarProps) => {
  const sceneWidth = size * BG_ASPECT;
  const coatWidth = sceneWidth;
  const coatHeight = size;
  const coatTop = 0;
  const portraitLeft = 0;

  // Body <img> CSS box is 2× the portrait, then scaled back — see BODY_CSS_OVERSAMPLE.
  const bodyCssWidth = coatWidth * BODY_CSS_OVERSAMPLE;
  const bodyCssHeight = coatHeight * BODY_CSS_OVERSAMPLE;
  const bodyStamp = svgStampPixelsForCssBox(bodyCssWidth, bodyCssHeight);

  // Head stays 1× in layout; denser SVG stamp only (approach B).
  const headCssWidth = coatWidth * HEAD_WIDTH_FRAC;
  const headCssHeight = coatHeight * HEAD_HEIGHT_FRAC;
  const headStamp = svgStampPixelsForCssBox(headCssWidth, headCssHeight);

  const { failed: headFailed, src: paddedHeadSrc } = useComposedSvgSrc(
    headImageUrl,
    headStamp.width,
    headStamp.height,
  );
  const { failed: bodyBackFailed, src: bodyBackSrc } = useComposedSvgSrc(
    bodyBackImageUrl,
    bodyStamp.width,
    bodyStamp.height,
  );
  const { failed: bodyFrontFailed, src: bodyFrontSrc } = useComposedSvgSrc(
    bodyFrontImageUrl,
    bodyStamp.width,
    bodyStamp.height,
  );

  // Fires onReady once this instance has nothing left to pop in piece by
  // piece - a ref guard rather than a dependency-driven single run, since a
  // later pose/weapon/backdrop change legitimately re-triggers all three
  // loads and callers of onReady only care about the very first reveal.
  const readyFiredRef = useRef(false);
  useEffect(() => {
    if (readyFiredRef.current) return;
    const headDone = headFailed || paddedHeadSrc !== null;
    const backDone = bodyBackFailed || bodyBackSrc !== null;
    const frontDone = bodyFrontFailed || bodyFrontSrc !== null;
    if (headDone && backDone && frontDone) {
      readyFiredRef.current = true;
      onReady?.();
    }
  }, [
    headFailed,
    paddedHeadSrc,
    bodyBackFailed,
    bodyBackSrc,
    bodyFrontFailed,
    bodyFrontSrc,
    onReady,
  ]);

  // Color-matches the fixed-palette uniform and head sprites to whichever
  // backdrop they're currently sitting on, so a random pick doesn't leave
  // the figure looking pasted onto a mismatched scene. Every stat involved
  // is precomputed (see colorMatch.ts) rather than sampled from the
  // rendered image, so this never needs to wait on an image load.
  const [uniformFilter, setUniformFilter] = useState('none');
  const [headFilter, setHeadFilter] = useState('none');
  const headStats = useMemo(() => {
    try {
      const params = new URL(headImageUrl).searchParams;
      return getHeadColorStats(
        params.get('hairVariant') ?? '',
        params.get('skinColor') ?? '',
        params.get('hairColor') ?? '',
      );
    } catch {
      return NEUTRAL_STATS;
    }
  }, [headImageUrl]);
  // Both layer URLs carry the same pose/bodyType, and there's one stat per
  // pose+bodyType (not per layer) - front is as good a source as back.
  const bodyStats = useMemo(() => {
    try {
      const params = new URL(bodyFrontImageUrl).searchParams;
      const pose = params.get('pose');
      const bodyType = params.get('bodyType');
      return (pose && bodyType && BODY_COLOR_STATS[`${pose}:${bodyType}`]) || NEUTRAL_STATS;
    } catch {
      return NEUTRAL_STATS;
    }
  }, [bodyFrontImageUrl]);
  // The aircraft subject is deliberately authored as a complete scene rather
  // than a normal color uniform render - applied once, on the outer scene
  // container, so backdrop/head/body all end up looking like one coherent
  // antique photo rather than a desaturated figure standing in front of a
  // full-color backdrop. Layered on top of (not instead of) the per-layer
  // colorMatchFilter values above - a CSS filter on a parent applies to its
  // already-filtered children as a whole, which is exactly what's wanted
  // here. A grittier film-grain/washed-blacks version (a real SVG filter -
  // feTurbulence/feComponentTransfer, since plain CSS filter functions can't
  // add noise or lift blacks asymmetrically) was tried and shelved for now;
  // revisit before relying on this being the final look.
  const isAircraftSubject = useMemo(() => {
    try {
      return new URL(bodyFrontImageUrl).searchParams.get('pose') === String(AIRCRAFT_SUBJECT_POSE);
    } catch {
      return false;
    }
  }, [bodyFrontImageUrl]);
  const scenePhotoFilter = scenePhotoFilterForBackground(backgroundImageKey);
  useEffect(() => {
    let cancelled = false;
    void getCachedColorStats(backgroundImageKey).then((backgroundStats) => {
      if (!cancelled)
        setUniformFilter(isAircraftSubject ? 'none' : colorMatchFilter(bodyStats, backgroundStats));
    });
    return () => {
      cancelled = true;
    };
  }, [backgroundImageKey, bodyStats, isAircraftSubject]);
  useEffect(() => {
    let cancelled = false;
    void getCachedColorStats(backgroundImageKey).then((backgroundStats) => {
      if (!cancelled)
        setHeadFilter(isAircraftSubject ? 'none' : colorMatchFilter(headStats, backgroundStats));
    });
    return () => {
      cancelled = true;
    };
  }, [backgroundImageKey, headStats, isAircraftSubject]);

  const backgroundSrc = `${GAME_ASSET_PREFIX}${backgroundImageKey}`;
  // Body art is a full-frame layer now (see the shared-canvas comment above
  // COAT_FRACTION used to live at) - "coat*" names kept only because
  // DecorationRack below still takes them as its panel box.
  const ribbons: Ribbon[] = serviceRibbons.slice(0, 9);
  const resolvedHeadPlacement = {
    height: `${HEAD_HEIGHT_FRAC * 100}%`,
    left: `${HEAD_LEFT_FRAC * 100}%`,
    top: `${HEAD_TOP_FRAC * 100}%`,
    width: `${HEAD_WIDTH_FRAC * 100}%`,
  };
  // Sized to roughly where the visible face sits, not the full padded
  // square resolvedHeadPlacement describes - that square is mostly
  // transparent margin, so a fallback that size renders as an oversized
  // blank shape.
  const fallbackHeadPlacement = {
    height: `${HEAD_FALLBACK_HEIGHT_FRAC * 100}%`,
    left: `${HEAD_FALLBACK_LEFT_FRAC * 100}%`,
    top: `${HEAD_FALLBACK_TOP_FRAC * 100}%`,
    width: `${HEAD_FALLBACK_WIDTH_FRAC * 100}%`,
  };

  const bodyLayerStyle: CSSProperties = {
    filter: uniformFilter,
    height: bodyCssHeight,
    left: 0,
    objectFit: 'fill',
    position: 'absolute',
    top: coatTop,
    transform: `scale(${1 / BODY_CSS_OVERSAMPLE})`,
    transformOrigin: 'top left',
    width: bodyCssWidth,
  };

  return (
    <div
      aria-label="Service uniform portrait"
      style={{
        backgroundColor: '#b7c4c7',
        backgroundImage: isAircraftSubject ? undefined : `url(${backgroundSrc})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        filter: scenePhotoFilter,
        height: size,
        overflow: 'hidden',
        position: 'relative',
        width: sceneWidth,
      }}
    >
      <div
        style={{
          height: size,
          left: portraitLeft,
          position: 'absolute',
          top: 0,
          width: coatWidth,
        }}
      >
        {!bodyBackFailed && bodyBackSrc && (
          <img
            alt=""
            draggable={false}
            src={bodyBackSrc}
            style={{ ...bodyLayerStyle, zIndex: PORTRAIT_Z_INDEX.bodyBack }}
          />
        )}
        {/* Head paints between the two body layers - `back` (rear props, a
            flag pole) sits behind the head, `front` (the uniform itself)
            sits in front of it and is meant to cover the lower part of the
            neck, which is exactly why the neck/shadow were added to the
            head art in the first place. Rendering the whole flattened body
            on top of the head (the old order, from before there were two
            separate layers) left both the head floating above the
            uniform's collar and any rear prop/flag incorrectly covering the
            face instead of sitting behind it. */}
        {!headFailed && paddedHeadSrc ? (
          <img
            alt=""
            draggable={false}
            src={paddedHeadSrc}
            style={{
              filter: headFilter,
              height: resolvedHeadPlacement.height,
              left: resolvedHeadPlacement.left,
              objectFit: 'fill',
              position: 'absolute',
              top: resolvedHeadPlacement.top,
              width: resolvedHeadPlacement.width,
              zIndex: PORTRAIT_Z_INDEX.head,
            }}
          />
        ) : (
          <div
            aria-label="Avatar unavailable"
            style={{
              background: '#f2d3b1',
              border: '1px solid #716b61',
              borderRadius: '50%',
              height: fallbackHeadPlacement.height,
              left: fallbackHeadPlacement.left,
              position: 'absolute',
              top: fallbackHeadPlacement.top,
              width: fallbackHeadPlacement.width,
              zIndex: PORTRAIT_Z_INDEX.head,
            }}
          >
            <span
              style={{
                color: '#26384a',
                fontSize: size * 0.11,
                left: '28%',
                position: 'absolute',
                top: '38%',
              }}
            >
              ●
            </span>
            <span
              style={{
                color: '#26384a',
                fontSize: size * 0.11,
                right: '28%',
                position: 'absolute',
                top: '38%',
              }}
            >
              ●
            </span>
            <span
              style={{
                borderBottom: '1px solid #8b3a32',
                borderRadius: '50%',
                bottom: '25%',
                height: '15%',
                left: '35%',
                position: 'absolute',
                width: '30%',
              }}
            />
          </div>
        )}
        {!bodyFrontFailed && bodyFrontSrc && (
          <img
            alt=""
            draggable={false}
            src={bodyFrontSrc}
            style={{ ...bodyLayerStyle, zIndex: PORTRAIT_Z_INDEX.bodyFront }}
          />
        )}
        {showAlignmentGrid && (
          <div
            aria-hidden="true"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255, 80, 80, .65) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 80, 80, .65) 1px, transparent 1px)',
              backgroundSize: '12.5% 100%, 100% 16.666%',
              border: '1px solid rgba(255, 80, 80, .8)',
              height: '50%',
              left: '50%',
              pointerEvents: 'none',
              position: 'absolute',
              top: '43%',
              width: '44%',
              zIndex: PORTRAIT_Z_INDEX.devGrid,
            }}
          />
        )}
        <DecorationRack
          coatHeight={coatHeight}
          coatTop={coatTop}
          coatWidth={coatWidth}
          medals={medals}
          ribbons={ribbons}
        />
      </div>
      {showAlignmentGrid && (
        <div
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255, 255, 255, .55) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, .55) 1px, transparent 1px)',
            backgroundSize: '10% 100%, 100% 10%',
            border: '1px solid rgba(255, 255, 255, .8)',
            inset: 0,
            pointerEvents: 'none',
            position: 'absolute',
          }}
        >
          <span
            style={{
              background: '#ff4d4d',
              height: 1,
              left: 0,
              position: 'absolute',
              top: '50%',
              width: '100%',
            }}
          />
          <span
            style={{
              background: '#ff4d4d',
              height: '100%',
              left: '50%',
              position: 'absolute',
              top: 0,
              width: 1,
            }}
          />
        </div>
      )}
      {/* Last child so it paints over every asset layer, including the coat
          (flush to the bottom edge) and head, which otherwise cover an
          inset box-shadow set on this container itself. */}
      <div
        aria-hidden="true"
        style={{
          boxShadow: `inset 0 0 0 1px ${PANEL_BORDER_COLOR}`,
          inset: 0,
          pointerEvents: 'none',
          position: 'absolute',
        }}
      />
    </div>
  );
};
