export type MedalTier = 'bronze' | 'silver' | 'gold';

interface MedalIconProps {
  /** Ribbon stripe colors, outer-to-center; mirrored symmetrically. */
  ribbon: [string, string] | [string, string, string];
  tier?: MedalTier;
  size?: number;
  /** Greyed-out rendering for medals not yet earned. */
  dimmed?: boolean;
}

const TIER_COLORS: Record<MedalTier, { face: string; rim: string; emboss: string }> = {
  bronze: { face: '#b08d57', rim: '#7a5c33', emboss: '#8f7040' },
  silver: { face: '#c9ced4', rim: '#8d949c', emboss: '#a7adb5' },
  gold: { face: '#d4af37', rim: '#9c7c1c', emboss: '#b6932a' },
};

/** A military-style decoration: striped ribbon drape over a metal disc. */
export const MedalIcon = ({ ribbon, tier = 'bronze', size = 48, dimmed }: MedalIconProps) => {
  const metal = TIER_COLORS[tier];
  const stripes = ribbon.length === 3 ? ribbon : [ribbon[0], ribbon[1], ribbon[0]];
  const stripeWidth = 24 / 5;

  return (
    <svg
      height={size}
      style={{
        display: 'block',
        ...(dimmed ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined),
      }}
      viewBox="3 1 26 46"
      width={(size * 26) / 46}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Ribbon: five vertical stripes mirrored around the center. */}
      <g>
        {[stripes[0], stripes[1], stripes[2], stripes[1], stripes[0]].map((color, index) => (
          <rect
            fill={color}
            height={20}
            key={index}
            width={stripeWidth}
            x={4 + index * stripeWidth}
            y={2}
          />
        ))}
        {/* V-notch cut into the ribbon tail. */}
        <polygon fill="var(--medal-bg, #fff)" points="4,22 16,16 28,22 28,23 4,23" opacity={0} />
        <polygon fill={metal.rim} points="13,21 16,25 19,21 19,23.5 16,27 13,23.5" />
      </g>
      {/* Suspension ring. */}
      <circle cx={16} cy={27} fill="none" r={1.8} stroke={metal.rim} strokeWidth={1.1} />
      {/* Disc. */}
      <circle cx={16} cy={37} fill={metal.face} r={9} stroke={metal.rim} strokeWidth={1.4} />
      <circle cx={16} cy={37} fill="none" r={6.8} stroke={metal.emboss} strokeWidth={0.8} />
      {/* Embossed star. */}
      <path
        d="M16 31.6 L17.5 35.2 L21.4 35.5 L18.4 38 L19.3 41.8 L16 39.7 L12.7 41.8 L13.6 38 L10.6 35.5 L14.5 35.2 Z"
        fill={metal.emboss}
        stroke={metal.rim}
        strokeWidth={0.5}
      />
    </svg>
  );
};

/** Stable ribbon colorways per metric medal. */
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
