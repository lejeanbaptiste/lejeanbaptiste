export type MedalTier = 'bronze' | 'silver' | 'gold';

/** The 5 rank metrics, plus 'special' for special/rare decorations. */
export type MedalMetric = 'texts' | 'tags' | 'disambiguated' | 'places' | 'entities' | 'special';

// Served at runtime by the desktop app's ljb-asset:// protocol handler,
// same as the uniform/backdrop art - see gameAssets.ts. Duplicated here
// rather than imported (main-process-only module, can't be imported from
// renderer code) - same convention UniformAvatar.tsx already follows for
// GAME_ASSET_PREFIX.
const GAME_ASSET_PREFIX = 'ljb-asset://';

/** Opaque key for the pre-rendered medal-disc art - see
 * visual_design/scripts/pack-assets.mjs's MANIFEST for the source list. */
export const medalAssetKey = (metric: MedalMetric, tier: MedalTier): string =>
  `medal/${metric}-${tier}`;

interface MedalIconProps {
  metric: MedalMetric;
  tier?: MedalTier;
  size?: number;
  /** Greyed-out rendering for medals not yet earned. */
  dimmed?: boolean;
}

// Matches the source art's own viewBox aspect (3 1 26 46) - see
// visual_design/rewards/medals/*.svg.
export const MEDAL_ART_ASPECT = 26 / 46;

/** A military-style decoration: striped ribbon drape over a metal disc.
 * The art itself is pre-rendered (see visual_design/rewards/medals/) and
 * shipped in the encrypted game-assets bundle - this component just picks
 * the right key and applies the earned/unearned dimming. */
export const MedalIcon = ({ metric, tier = 'bronze', size = 48, dimmed }: MedalIconProps) => (
  <img
    alt=""
    draggable={false}
    height={size}
    src={`${GAME_ASSET_PREFIX}${medalAssetKey(metric, tier)}`}
    style={{
      display: 'block',
      ...(dimmed ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined),
    }}
    width={size * MEDAL_ART_ASPECT}
  />
);

/** Stable ribbon colorways per metric medal - used for the separate
 * service-ribbon stripe bars (RibbonRack in UniformAvatar.tsx), not the
 * medal-disc art itself. */
export const METRIC_RIBBONS: Record<string, [string, string] | [string, string, string]> = {
  texts: ['#4a5d23', '#c8b560'],
  tags: ['#1f3a93', '#e8e8e8'],
  disambiguated: ['#7b1113', '#f0e68c'],
  places: ['#0f6b4f', '#d9d9d9'],
  entities: ['#3d2b56', '#c49a3a'],
};

/** Rare and special decorations share a solemn dark-red sash. */
export const SPECIAL_RIBBON: [string, string, string] = ['#26201a', '#8b0000', '#c9a227'];

export const tierForRankIndex = (rankIndex: number): MedalTier =>
  rankIndex >= 6 ? 'gold' : rankIndex >= 3 ? 'silver' : 'bronze';
