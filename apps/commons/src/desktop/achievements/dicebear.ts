export interface DiceBearAvatarOptions {
  seed: string;
  eyebrowsVariant: string;
  eyesVariant: string;
  mouthVariant: string;
  glassesVariant: string;
  glassesProbability: number;
  hairVariant: string;
  skinColor: string;
  hairColor: string;
}

export const createDefaultDiceBearAvatar = (seed: string): DiceBearAvatarOptions => ({
  seed: seed.trim() || 'leaf-writer',
  eyebrowsVariant: 'variant01',
  eyesVariant: 'variant01',
  mouthVariant: 'variant01',
  glassesVariant: 'variant01',
  glassesProbability: 0,
  hairVariant: 'short01',
  skinColor: 'f2d3b1',
  hairColor: '3eac2c',
});

/** Build a deterministic Adventurer SVG URL. No uploaded image is involved. */
export const diceBearAvatarUrl = (options: DiceBearAvatarOptions): string => {
  const params = new URLSearchParams({
    seed: options.seed,
    eyebrowsVariant: options.eyebrowsVariant,
    eyesVariant: options.eyesVariant,
    mouthVariant: options.mouthVariant,
    glassesVariant: options.glassesVariant,
    glassesProbability: String(options.glassesProbability),
    hairVariant: options.hairVariant,
    skinColor: options.skinColor,
    hairColor: options.hairColor,
  });
  return `https://api.dicebear.com/10.x/adventurer/svg?${params.toString()}`;
};

export const MOUTH_VARIANTS = Array.from(
  { length: 30 },
  (_, index) => `variant${String(index + 1).padStart(2, '0')}`,
);

export const EYEBROW_VARIANTS = Array.from(
  { length: 15 },
  (_, index) => `variant${String(index + 1).padStart(2, '0')}`,
);

export const EYE_VARIANTS = Array.from(
  { length: 26 },
  (_, index) => `variant${String(index + 1).padStart(2, '0')}`,
);

export const GLASSES_VARIANTS = Array.from(
  { length: 5 },
  (_, index) => `variant${String(index + 1).padStart(2, '0')}`,
);

export const HAIR_VARIANTS = [
  'short01',
  'short05',
  'short09',
  'short14',
  'short19',
  'long03',
  'long10',
  'long18',
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
