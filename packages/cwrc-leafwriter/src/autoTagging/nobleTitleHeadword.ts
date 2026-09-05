/**
 * Detect noble-title headwords so backfill does not treat them as 姓名.
 * Pack compile already keeps title can_name out of typed primary persName;
 * Grognard must not surname-segment those display surfaces.
 */

export interface NobleTitleParts {
  fief?: string | null;
  familyName?: string | null;
  posthumousName?: string | null;
  posthumousNameAbbr?: string | null;
  roleName?: string | null;
}

/** Multi-character ranks first — single-char 王/公/子 are too common in real names. */
export const NOBLE_TITLE_RANK_SUFFIXES = [
  '皇太后',
  '皇太子',
  '皇后',
  '太后',
  '太妃',
  '太子',
  '世子',
  '公主',
  '皇女',
  '貴妃',
  '賢妃',
  '淑妃',
  '夫人',
  '天皇',
  '天王',
  '後主',
  '幼主',
] as const;

const normalize = (value: string | null | undefined): string =>
  (value ?? '').normalize('NFC').trim();

/** Surfaces that Norbert / tag bomb treat as a full noble-title string. */
export function nobleTitleSurfaceVariants(title: NobleTitleParts): string[] {
  const fief = normalize(title.fief);
  const family = normalize(title.familyName);
  const posthumous = normalize(title.posthumousName);
  const abbr = normalize(title.posthumousNameAbbr);
  const role = normalize(title.roleName);
  if (!role) return [];
  const combos = [
    [fief, family, posthumous, role],
    [fief, family, abbr, role],
    [fief, posthumous, role],
    [fief, abbr, role],
    [family, posthumous, role],
    [family, abbr, role],
    [posthumous, role],
    [abbr, role],
    [fief, family, role],
    [fief, role],
    [family, role],
  ];
  const out: string[] = [];
  for (const parts of combos) {
    const text = parts.filter(Boolean).join('');
    if (text.length >= 2) out.push(text);
  }
  return [...new Set(out)];
}

export function endsWithNobleTitleRank(surface: string): boolean {
  const text = normalize(surface);
  if (text.length < 2) return false;
  return NOBLE_TITLE_RANK_SUFFIXES.some((rank) => text.endsWith(rank) && text.length > rank.length);
}

/**
 * True when `surface` is a noble-title headword (empress, princess, …),
 * not a personal 姓名 suitable for surname segmentation.
 */
export function isNobleTitleHeadword(
  surface: string | null | undefined,
  nobleTitles?: readonly NobleTitleParts[] | null,
): boolean {
  const text = normalize(surface);
  if (!text) return false;
  if (nobleTitles?.length) {
    for (const title of nobleTitles) {
      if (nobleTitleSurfaceVariants(title).includes(text)) return true;
    }
  }
  return endsWithNobleTitleRank(text);
}

/**
 * Surface to feed 姓名 splitters / preferCanonicalFamilyGiven.
 * Returns null when the headword is a title — callers should then use only
 * explicit pack family/given rows, never invent a split from the title.
 */
export function personalNameForSegmentation(
  headword: string | null | undefined,
  typedNames: readonly { text: string; type: string }[],
  nobleTitles?: readonly NobleTitleParts[] | null,
): string | null {
  const head = normalize(headword);
  const family = typedNames.find((name) => name.type === 'family')?.text;
  const given = typedNames.find((name) => name.type === 'given')?.text;
  const familyNorm = normalize(family);
  const givenNorm = normalize(given);
  if (familyNorm && givenNorm && `${familyNorm}${givenNorm}` === head) return head;
  if (isNobleTitleHeadword(head, nobleTitles)) return null;
  return head || null;
}

/**
 * Best personal primary for minting / entity labels.
 * Prefers an explicit pack `primary` or reconstructed 姓+名 over a
 * display-only noble-title headword (which stays usable as a fallback label).
 */
export function preferredEntityPrimaryName(
  headword: string | null | undefined,
  typedNames: readonly { text: string; type?: string }[] = [],
): string {
  const head = normalize(headword);
  const typedPrimary = normalize(typedNames.find((name) => name.type === 'primary')?.text);
  if (typedPrimary) return typedPrimary;
  const familyNorm = normalize(typedNames.find((name) => name.type === 'family')?.text);
  const givenNorm = normalize(typedNames.find((name) => name.type === 'given')?.text);
  if (familyNorm && givenNorm) return `${familyNorm}${givenNorm}`;
  return head;
}

/** Title parts from authority metadata (single or list). */
export function nobleTitlesFromMetadata(
  metadata:
    | {
        nobleTitle?: NobleTitleParts | null;
        nobleTitles?: readonly NobleTitleParts[] | null;
      }
    | null
    | undefined,
): NobleTitleParts[] | null {
  if (!metadata) return null;
  if (metadata.nobleTitles?.length) return [...metadata.nobleTitles];
  if (metadata.nobleTitle) return [metadata.nobleTitle];
  return null;
}

/**
 * Cleanup for a prior surname-split of a noble-title headword.
 * Returns name texts to withdraw and whether the given-name scalar should clear.
 */
export function inventedTitleSplitCleanup(input: {
  headword: string | null | undefined;
  nameEntries?: readonly { text: string; type?: string | null }[];
  familyName?: string | null;
  givenName?: string | null;
  typedNames?: readonly { text: string; type: string }[];
  nobleTitles?: readonly NobleTitleParts[] | null;
}): { tombstoneTexts: string[]; clearGivenName: boolean; preferredFamily: string | null } {
  const head = normalize(input.headword);
  const typedNames = input.typedNames ?? [];
  if (!head || !isNobleTitleHeadword(head, input.nobleTitles)) {
    return { tombstoneTexts: [], clearGivenName: false, preferredFamily: null };
  }
  if (personalNameForSegmentation(head, typedNames, input.nobleTitles)) {
    return { tombstoneTexts: [], clearGivenName: false, preferredFamily: null };
  }

  const packFamilies = new Set(
    typedNames
      .filter((name) => name.type === 'family')
      .map((name) => normalize(name.text))
      .filter(Boolean),
  );
  const packGivens = new Set(
    typedNames
      .filter((name) => name.type === 'given')
      .map((name) => normalize(name.text))
      .filter(Boolean),
  );
  const preferredFamily = packFamilies.values().next().value ?? null;

  const tombstone = new Set<string>();
  for (const entry of input.nameEntries ?? []) {
    const text = normalize(entry.text);
    if (!text || text === head) continue;
    const type = (entry.type ?? '').toLowerCase();
    if (type === 'family' || type === 'familyname') {
      if (!packFamilies.has(text)) tombstone.add(text);
    } else if (type === 'given' || type === 'givenname') {
      if (!packGivens.has(text)) tombstone.add(text);
    }
  }

  // Also catch scalar-only invents that never got typed name rows.
  const familyScalar = normalize(input.familyName);
  const givenScalar = normalize(input.givenName);
  if (familyScalar && !packFamilies.has(familyScalar) && familyScalar !== head) {
    tombstone.add(familyScalar);
  }
  if (givenScalar && !packGivens.has(givenScalar) && givenScalar !== head) {
    tombstone.add(givenScalar);
  }

  const clearGivenName = Boolean(givenScalar && !packGivens.has(givenScalar));

  return {
    tombstoneTexts: [...tombstone],
    clearGivenName,
    preferredFamily,
  };
}
