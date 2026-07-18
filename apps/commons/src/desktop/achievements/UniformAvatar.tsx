import { useColorScheme } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { colorMatchFilter, type ColorStats } from './colorMatch';
import { BG_POOL_BY_RANK } from './generatedBackgroundPools';
import { getHeadColorStats } from './headColorStats';
import { MedalIcon, type MedalMetric, type MedalTier } from './MedalIcon';

// Served at runtime by the desktop app's ljb-asset:// protocol handler
// (see apps/desktop/src/gameAssets.ts), which decrypts them from the
// bundled, encrypted resources/game-assets/assets.bin. The source artwork
// lives in the private visual_design repo, not this one.
export const GAME_ASSET_PREFIX = 'ljb-asset://';
export const UNIFORM_KEYS = ['uniforms/1', 'uniforms/2', 'uniforms/3', 'uniforms/4', 'uniforms/5', 'uniforms/6', 'uniforms/7'];

type Ribbon = [string, string] | [string, string, string];

interface UniformAvatarProps {
  /** Highest rank index held (0-based into RANK_NAMES), -1 when unranked. */
  rankIndex: number;
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
  /** ljb-asset:// key of the backdrop to show, e.g. "bg/3b" - see
   * backgroundPoolForRank/pickBackgroundKey below for how callers choose one. */
  backgroundImageKey: string;
  /** Development-only alignment overlay for tuning portrait placement. */
  showAlignmentGrid?: boolean;
  size?: number;
}

// One image per rank (I-VII): a 340x319 canvas, coat flush to the bottom
// edge and collar tip flush to the top edge, identical across all seven so
// a single head placement lines up against every rank.
const UNIFORM_SRCS = UNIFORM_KEYS.map((key) => `${GAME_ASSET_PREFIX}${key}`);
export const UNIFORM_ASPECT = 340 / 319;

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

// Fraction of the portrait frame height the coat occupies, anchored to the
// bottom. The rest is sky reserved above the collar tip (which sits right at
// the coat's own top edge) for the head to sit in. This new artwork has much
// broader shoulders/epaulettes than the old sheet, so the coat needs a
// smaller share of the frame than before or the head reads as too small
// against them - 0.63 keeps the whole figure (coat + head) comfortably
// inside the frame with margin to spare, rather than filling it edge to edge.
export const COAT_FRACTION = 0.63;

// The DiceBear Adventurer SVG has a 762x762 content canvas. Some hair
// variants (e.g. long18) draw strands outside it, so the local compositor
// (apps/desktop/src/avatarAssets.ts) bakes a content-sized pad on every
// side directly into the fetched SVG - it always arrives pre-padded, wide
// enough that nothing can clip regardless of how far a layer overflows.
export const SVG_PAD = 762;
export const SVG_VIEWBOX_SIZE = 762;
export const PADDED_VIEWBOX_SIZE = SVG_VIEWBOX_SIZE + SVG_PAD * 2;

// Fraction of the (padded) canvas the DiceBear face actually occupies,
// measured from the unpadded SVG's rendered bounding box and shifted by
// SVG_PAD. Intentional headroom, not something to crop away: it guarantees
// the head never touches the frame even for taller hair variants, so it's
// kept intact (object-fit: contain, not cropped).
const HEAD_CONTENT = {
  height: 472.9 / PADDED_VIEWBOX_SIZE,
  left: (141.4 + SVG_PAD) / PADDED_VIEWBOX_SIZE,
  top: (138.1 + SVG_PAD) / PADDED_VIEWBOX_SIZE,
  width: 502.5 / PADDED_VIEWBOX_SIZE,
};

// The head box is a fixed-size square (frame-fraction units): with
// object-fit:contain and a box this size, the render is height-limited (the
// box is always given full coat width below), so the square fills exactly
// edge-to-edge with no wasted padding.
//
// HEAD_BOX_TOP is pinned to a small positive margin (not solved from a chin
// target) so the DiceBear image's own bounding square - padding included -
// never gets clipped by the frame, even for hair variants taller than the
// one this was measured against. The resulting chin position lands where it
// should: covering most of the collar's black interior with the outline
// just touching the red trim.
export const HEAD_BOX_SIZE = 0.52 * (PADDED_VIEWBOX_SIZE / SVG_VIEWBOX_SIZE);
export const HEAD_BOX_TOP = -0.01;

// The empty chest panel to the right of the button line, as a fraction of
// the coat image's own 340x319 canvas. Measured by masking every uniform
// rank for its coat-navy color and intersecting the masks, so this rectangle
// sits clear of the collar/epaulettes above, the sash intruding on the
// highest rank below, the button line on the left, and the sleeve seam on
// the right - across all seven ranks at once.
export const DECORATION_PANEL = { height: 0.3597, left: 0.4276, top: 0.25, width: 0.2813 };

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
            border: '1px solid rgba(24, 35, 52, .75)',
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
      }}
    >
      {ribbons.length > 0 && (
        <RibbonRack cols={ribbonGrid.cols} itemHeight={ribbonGrid.itemHeight} ribbons={ribbons} />
      )}
      <MedalRack cols={medalGrid.cols} itemHeight={medalGrid.itemHeight} medals={medals} />
    </div>
  );
};

export const UniformAvatar = ({
  rankIndex,
  serviceRibbons,
  medals,
  headImageUrl,
  backgroundImageKey,
  showAlignmentGrid = false,
  size = 96,
}: UniformAvatarProps) => {
  // This app uses MUI's CSS-variables theming, where theme.palette.mode is
  // a static seed rather than the live mode - useColorScheme() is what
  // every other mode-aware component here reads instead (see
  // HighlighterIcon.tsx, icons/tab/index.tsx).
  const { mode, systemMode } = useColorScheme();
  const isDarkMode = mode === 'dark' || (mode === 'system' && systemMode === 'dark');
  // Trims the soft/anti-aliased edge left by the composited artwork. An
  // inset box-shadow (not a border) so it paints over the existing frame
  // without shifting the box model - every child below is positioned in
  // pixel/percentage terms that assume the frame is exactly `size` tall.
  const frameBorderColor = isDarkMode ? '#fff' : '#000';
  const [headFailed, setHeadFailed] = useState(false);
  const [paddedHeadSrc, setPaddedHeadSrc] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  useEffect(() => setHeadFailed(false), [headImageUrl]);
  useEffect(() => {
    let cancelled = false;
    setPaddedHeadSrc(null);
    void fetch(headImageUrl)
      .then((response) => response.text())
      .then((svgText) => {
        if (cancelled) return;
        // Already pre-padded by the local compositor - see SVG_PAD above.
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const objectUrl = URL.createObjectURL(blob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = objectUrl;
        setPaddedHeadSrc(objectUrl);
      })
      .catch(() => setHeadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [headImageUrl]);
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );
  const uniformIndex = Math.max(0, Math.min(UNIFORM_KEYS.length - 1, rankIndex));
  const uniformKey = UNIFORM_KEYS[uniformIndex]!;
  const uniformSrc = UNIFORM_SRCS[uniformIndex]!;

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
  useEffect(() => {
    let cancelled = false;
    void Promise.all([getCachedColorStats(backgroundImageKey), getCachedColorStats(uniformKey)]).then(
      ([backgroundStats, uniformStats]) => {
        if (!cancelled) setUniformFilter(colorMatchFilter(uniformStats, backgroundStats));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [backgroundImageKey, uniformKey]);
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
  // The coat is anchored to the bottom of the frame; the remaining fraction
  // above it is sky, reserved for the head to sit in (see COAT_FRACTION).
  const coatHeight = size * COAT_FRACTION;
  const coatWidth = coatHeight * UNIFORM_ASPECT;
  const coatTop = size - coatHeight;
  const portraitLeft = (sceneWidth - coatWidth) / 2;
  const ribbons: Ribbon[] = serviceRibbons.slice(0, 9);
  // Box width is the full coat width - wider than HEAD_BOX_SIZE - so
  // object-fit:contain is always height-limited and the square renders at
  // exactly HEAD_BOX_SIZE regardless of the coat's own proportions.
  const resolvedHeadPlacement = {
    height: `${HEAD_BOX_SIZE * 100}%`,
    left: '0%',
    top: `${HEAD_BOX_TOP * 100}%`,
    width: '100%',
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
        <img
          alt=""
          draggable={false}
          src={uniformSrc}
          style={{
            filter: uniformFilter,
            height: coatHeight,
            left: 0,
            position: 'absolute',
            top: coatTop,
            width: coatWidth,
          }}
        />
        {!headFailed && paddedHeadSrc ? (
          <img
            alt=""
            draggable={false}
            onError={() => setHeadFailed(true)}
            src={paddedHeadSrc}
            style={{
              filter: headFilter,
              height: resolvedHeadPlacement.height,
              left: resolvedHeadPlacement.left,
              objectFit: 'contain',
              position: 'absolute',
              top: resolvedHeadPlacement.top,
              width: resolvedHeadPlacement.width,
              zIndex: 2,
            }}
          />
        ) : (
          <div
            aria-label="Avatar unavailable"
            style={{
              background: '#f2d3b1',
              border: '1px solid #716b61',
              borderRadius: '50%',
              height: '50%',
              left: '15%',
              position: 'absolute',
              top: '-2%',
              width: '70%',
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
              zIndex: 4,
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
          boxShadow: `inset 0 0 0 1px ${frameBorderColor}`,
          inset: 0,
          pointerEvents: 'none',
          position: 'absolute',
        }}
      />
    </div>
  );
};
