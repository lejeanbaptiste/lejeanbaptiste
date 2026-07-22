import { useEffect, useMemo, useRef, useState } from 'react';
import { colorMatchFilter, type ColorStats } from './colorMatch';
import { BG_POOL_BY_RANK } from './generatedBackgroundPools';
import { BODY_COLOR_STATS, POSE_INDICES, WEAPON_POOLS } from './generatedBodyPools';
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

type Ribbon = [string, string] | [string, string, string];

interface UniformAvatarProps {
  /** Colorways of the rank medals currently held. */
  serviceRibbons: Ribbon[];
  /** Earned medals displayed as miniatures on the uniform. */
  medals: Array<{
    metric: MedalMetric;
    tier: MedalTier;
    label: string;
  }>;
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
}

/** Uniform random pick among every pose that has a full rank kit (see
 * POSE_INDICES in generatedBodyPools.ts, auto-discovered at pack time),
 * excluding `previousPose` when there's more than one option - same
 * no-repeat-in-a-row behavior as pickBackgroundKey below. Pose is genuinely
 * random per render, never persisted, per Daniel's "pose and weapons will be
 * random". */
export const pickPose = (previousPose: number | null): number => {
  const choices =
    previousPose !== null && POSE_INDICES.length > 1
      ? POSE_INDICES.filter((pose) => pose !== previousPose)
      : POSE_INDICES;
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

/** True if this rank has anything at all to show for `bodyType` in this
 * channel - either a universal (sex-independent) piece, or a bodyType-
 * specific piece under any variant. */
const channelHasRankFor = (
  channel: (typeof WEAPON_POOLS)[number][number],
  rank: number,
  bodyType: 'm' | 'f',
): boolean => {
  const entry = channel[rank];
  if (!entry) return false;
  if (entry.universal.length > 0) return true;
  const byBodyType = entry[bodyType];
  return !!byBodyType && Object.keys(byBodyType).length > 0;
};

/** Daniel's rule: "at that rank or above, that weapon asset enters
 * rotation... rank 5 will cycle randomly through rank 1-5 assets" - the
 * exact same cumulative-pool random pick as backgroundPoolForRank/
 * pickBackgroundKey, just over weapon-rank tiers instead of backdrop
 * letters. Returns null when this pose has no weapon at all, or the
 * player's rank hasn't unlocked any tier yet.
 *
 * Some ranks have sex-specific alternates at the same rank (body6.svg's
 * f-rank2-a vs f-rank2-b) - mutually exclusive designs, not simultaneous
 * parts, so exactly one variant letter is picked per rank+bodyType. That
 * pick is made *once*, shared across every channel (not independently per
 * channel), and only from variant letters common to every channel that has
 * a bodyType-specific piece at this rank - picking independently per
 * channel could combine a front half authored for variant "a" with a rear
 * half only drawn for variant "b" (body6.svg's rank4/rank5 are asymmetric
 * like this: not every variant has a matching piece in both the background
 * and foreground weapon groups). Falls back to the union across channels
 * only if they share no variant at all, so a rank with genuinely disjoint
 * per-channel authoring still shows *something* rather than nothing. */
export const pickWeapon = (
  poseIndex: number,
  bodyType: 'm' | 'f',
  rankIndex: number,
  previousRank: number | null,
): WeaponSelection | null => {
  const channels = WEAPON_POOLS[poseIndex] ?? [];
  if (channels.length === 0) return null;

  const unlockedRanks = new Set<number>();
  for (const channel of channels) {
    for (const rank of Object.keys(channel).map(Number)) {
      if (rank <= rankIndex + 1 && channelHasRankFor(channel, rank, bodyType)) unlockedRanks.add(rank);
    }
  }
  if (unlockedRanks.size === 0) return null;

  const pool = Array.from(unlockedRanks);
  const choices = previousRank !== null && pool.length > 1 ? pool.filter((rank) => rank !== previousRank) : pool;
  const rank = choices[Math.floor(Math.random() * choices.length)]!;

  // Variant keys the bodyType has at this rank, per channel (only channels
  // that have *something* for this bodyType at this rank count).
  const variantKeySetsPerChannel = channels
    .map((channel) => channel[rank]?.[bodyType])
    .filter((byBodyType): byBodyType is Record<string, readonly string[]> => !!byBodyType)
    .map((byBodyType) => new Set(Object.keys(byBodyType)));

  let variant: string | null = null;
  if (variantKeySetsPerChannel.length > 0) {
    const intersection = variantKeySetsPerChannel.reduce((acc, keys) =>
      new Set(Array.from(acc).filter((key) => keys.has(key))),
    );
    const union = new Set(variantKeySetsPerChannel.flatMap((keys) => Array.from(keys)));
    const candidates = Array.from(intersection.size > 0 ? intersection : union);
    variant = candidates[Math.floor(Math.random() * candidates.length)]!;
  }

  // Every id sharing this rank+bodyType+variant within a channel is a
  // simultaneous part of the same design (e.g. bodies/body7.svg's rank2 has
  // two images ~170 units apart - one per hand), so all of them come along
  // together.
  const imageIds: string[] = [];
  for (const channel of channels) {
    const entry = channel[rank];
    if (!entry) continue;
    imageIds.push(...entry.universal);
    if (variant !== null) {
      const idsForVariant = entry[bodyType]?.[variant];
      if (idsForVariant) imageIds.push(...idsForVariant);
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
  return `${BODY_SCHEME_PREFIX}${params.toString()}`;
};

// Rank-gated portrait backdrops, one letter-suffixed pool per rank
// (RANK_NAMES[0..6]). The pool available at a given rank is cumulative -
// everything from rank 1 up through the player's current rank - so ranking
// up adds backdrops rather than swapping them out. Pools themselves come
// from generatedBackgroundPools.ts (derived from rewards/bg_*.png filenames
// at pack time - see visual_design/scripts/pack-assets.mjs), not hand-listed
// here, so a new backdrop file doesn't need a code change to show up.

/** Every backdrop unlocked at or below `rankIndex` (-1/unranked still gets
 * the rank-1 pool, so there's always something to show). */
export const backgroundPoolForRank = (rankIndex: number): string[] =>
  BG_POOL_BY_RANK.slice(0, Math.max(0, rankIndex) + 1).flat();

/** Picks a random backdrop from the unlocked pool, excluding whichever key
 * was shown last (when the pool has more than one option) so the same
 * image never appears twice in a row. */
export const pickBackgroundKey = (rankIndex: number, previousKey: string | null): string => {
  const pool = backgroundPoolForRank(rankIndex);
  const choices = previousKey && pool.length > 1 ? pool.filter((key) => key !== previousKey) : pool;
  return choices[Math.floor(Math.random() * choices.length)]!;
};

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
export const HEAD_FALLBACK_LEFT_FRAC = HEAD_LEFT_FRAC + HEAD_CONTENT_FRACTION_OF_SQUARE.left * HEAD_WIDTH_FRAC;
export const HEAD_FALLBACK_TOP_FRAC = HEAD_TOP_FRAC + HEAD_CONTENT_FRACTION_OF_SQUARE.top * HEAD_HEIGHT_FRAC;
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
// a realistic rack density but blows a single early medal or ribbon up to
// fill the whole panel. Flooring the count it packs against to a plausible
// early-service size (one ribbon per metric; a handful of medals) keeps
// icons a sane size until there are actually enough to fill the rack.
export const RIBBON_COUNT_FLOOR = 5;
export const MEDAL_COUNT_FLOOR = 6;

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
 * miniatures, both packed as large as they can go within DECORATION_PANEL -
 * the coat's actual empty chest area - rather than positioned by eye. */
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
  const ribbonGrid = packGrid(
    ribbons.length > 0 ? Math.max(ribbons.length, RIBBON_COUNT_FLOOR) : 1,
    panelWidth,
    ribbonBoxHeight,
    RIBBON_ASPECT,
  );
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

/** Both the head (ljb-avatar://) and body (ljb-body://) images are SVGs
 * composited on the fly by a custom Electron protocol handler - fetched as
 * text and re-served as a blob object URL rather than used as a plain <img
 * src>, the same workaround this component already relied on for the head
 * before the body art existed too. */
function useComposedSvgSrc(url: string): { failed: boolean; src: string | null } {
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
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const objectUrl = URL.createObjectURL(blob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = objectUrl;
        setSrc(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);
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
}: UniformAvatarProps) => {
  const { failed: headFailed, src: paddedHeadSrc } = useComposedSvgSrc(headImageUrl);
  const { failed: bodyBackFailed, src: bodyBackSrc } = useComposedSvgSrc(bodyBackImageUrl);
  const { failed: bodyFrontFailed, src: bodyFrontSrc } = useComposedSvgSrc(bodyFrontImageUrl);

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
  useEffect(() => {
    let cancelled = false;
    void getCachedColorStats(backgroundImageKey).then((backgroundStats) => {
      if (!cancelled) setUniformFilter(colorMatchFilter(bodyStats, backgroundStats));
    });
    return () => {
      cancelled = true;
    };
  }, [backgroundImageKey, bodyStats]);
  useEffect(() => {
    let cancelled = false;
    void getCachedColorStats(backgroundImageKey).then((backgroundStats) => {
      if (!cancelled) setHeadFilter(colorMatchFilter(headStats, backgroundStats));
    });
    return () => {
      cancelled = true;
    };
  }, [backgroundImageKey, headStats]);

  const backgroundSrc = `${GAME_ASSET_PREFIX}${backgroundImageKey}`;
  const sceneWidth = size * BG_ASPECT;
  // Body art is a full-frame layer now (see the shared-canvas comment above
  // COAT_FRACTION used to live at) - "coat*" names kept only because
  // DecorationRack below still takes them as its panel box.
  const coatWidth = sceneWidth;
  const coatHeight = size;
  const coatTop = 0;
  const portraitLeft = 0;
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

  return (
    <div
      aria-label="Service uniform portrait"
      style={{
        backgroundColor: '#b7c4c7',
        backgroundImage: `url(${backgroundSrc})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
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
            style={{
              filter: uniformFilter,
              height: coatHeight,
              left: 0,
              objectFit: 'fill',
              position: 'absolute',
              top: coatTop,
              width: coatWidth,
              zIndex: PORTRAIT_Z_INDEX.bodyBack,
            }}
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
            style={{
              filter: uniformFilter,
              height: coatHeight,
              left: 0,
              objectFit: 'fill',
              position: 'absolute',
              top: coatTop,
              width: coatWidth,
              zIndex: PORTRAIT_Z_INDEX.bodyFront,
            }}
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
