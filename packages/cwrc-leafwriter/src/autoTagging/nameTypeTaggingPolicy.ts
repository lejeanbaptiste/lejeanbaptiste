import type { AuthorityCandidate } from './authority';
import { ALL_NAME_TYPES, normalizeNameType, type NameTypeId } from './nameTypes';

export type NameTypeTaggingBucket = 'phase1' | 'phase2' | 'never';

export interface CustomNameType {
  id: string;
  label: string;
  labelsByLang?: Record<string, string>;
  bucket: NameTypeTaggingBucket;
}

export interface NameTypeTaggingPolicy {
  /** Resolved bucket per built-in or custom type id (except length-gated `art`). */
  buckets: Record<string, NameTypeTaggingBucket>;
  customTypes: CustomNameType[];
  artMinCodePoints: number;
}

export const DEFAULT_ART_MIN_CODEPOINTS = 3;

/**
 * `art`'s phase-1 gate counts Unicode code points (see `bucketForTypedName`).
 * A single Tibetan syllable is 2–3 letter code points plus its trailing tsheg
 * (U+0F0B), so the default of 3 waves every one-syllable string through — and
 * one Tibetan syllable is almost never a work title worth phase-1 tagging.
 * Requiring 4 keeps genuine multi-syllable titles in phase 1 while dropping
 * bare syllables to phase 2. Han/kana titles are dense enough that 3 already
 * works, so only `bo` moves.
 */
export function defaultArtMinCodePointsForLanguage(lang: string | null): number {
  return languagePresetKey(lang) === 'bo' ? 4 : DEFAULT_ART_MIN_CODEPOINTS;
}

const CUSTOM_ID_RE = /^[a-z][a-z0-9_-]*$/;

type LanguagePresetKey = 'zh' | 'ja' | 'bo' | 'en';

function languagePresetKey(lang: string | null): LanguagePresetKey {
  const base = (lang ?? 'zh').split('-')[0]!.toLowerCase();
  if (base === 'ja') return 'ja';
  if (base === 'bo') return 'bo';
  if (base === 'en') return 'en';
  return 'zh';
}

/** Language-aware default bucket map (static types only; `art` is length-gated at seed time). */
export function defaultPolicyForLanguage(
  lang: string | null,
): Record<string, NameTypeTaggingBucket> {
  const buckets: Record<string, NameTypeTaggingBucket> = Object.fromEntries(
    ALL_NAME_TYPES.map((type) => [type, 'phase1' as NameTypeTaggingBucket]),
  );
  buckets.family = 'never';

  switch (languagePresetKey(lang)) {
    case 'ja':
      buckets.courtesy = 'phase2';
      buckets.given = 'phase2';
      buckets.birth = 'phase2';
      break;
    case 'bo':
      // Tibetan has no family/given split, and personal reference is dominated
      // by multi-syllable religious and incarnation-lineage names; the parts a
      // Chinese-shaped model would guess as given/courtesy/birth/variant are
      // unreliable here, so they wait for phase 2 review.
      buckets.given = 'phase2';
      buckets.variant = 'phase2';
      buckets.courtesy = 'phase2';
      buckets.birth = 'phase2';
      break;
    case 'en':
      buckets.given = 'phase2';
      break;
    default:
      buckets.courtesy = 'phase2';
      buckets.given = 'phase2';
      break;
  }

  return buckets;
}

export interface NameTypeTaggingSettingsInput {
  nameTypeTaggingPolicy?: Record<string, NameTypeTaggingBucket>;
  customNameTypes?: CustomNameType[];
  artMinCodePoints?: number;
  /** Legacy binary exclusion list; migrated to phase2 when no explicit policy map. */
  excludedNameTypes?: string[];
}

/** Merge persisted settings with language presets and legacy `excludedNameTypes`. */
export function resolveNameTypeTaggingPolicy(
  settings?: NameTypeTaggingSettingsInput,
  sourceLanguage?: string | null,
): NameTypeTaggingPolicy {
  const buckets = { ...defaultPolicyForLanguage(sourceLanguage ?? null) };

  if (!settings?.nameTypeTaggingPolicy && settings?.excludedNameTypes) {
    for (const raw of settings.excludedNameTypes) {
      const type = normalizeNameType(raw);
      if (type) buckets[type] = 'phase2';
    }
  }

  if (settings?.nameTypeTaggingPolicy) {
    for (const [id, bucket] of Object.entries(settings.nameTypeTaggingPolicy)) {
      if (bucket === 'phase1' || bucket === 'phase2' || bucket === 'never') {
        buckets[id] = bucket;
      }
    }
  }

  const customTypes = settings?.customNameTypes ?? [];
  for (const custom of customTypes) {
    buckets[custom.id] = custom.bucket;
  }

  if (!settings?.nameTypeTaggingPolicy?.family) {
    buckets.family = 'never';
  }

  return {
    buckets,
    customTypes,
    artMinCodePoints:
      settings?.artMinCodePoints ?? defaultArtMinCodePointsForLanguage(sourceLanguage ?? null),
  };
}

function codePointCount(text: string): number {
  return [...text].length;
}

/**
 * Bucket for a typed name at seed time. Untyped (`null`) → phase1; `art` is
 * length-gated unless the policy marks it never; unknown custom ids are looked
 * up in `customTypes`; unknown built-ins → phase1.
 */
export function bucketForTypedName(
  type: string | null,
  text: string,
  policy: NameTypeTaggingPolicy,
): NameTypeTaggingBucket {
  if (type === null) return 'phase1';

  const normalized = normalizeNameType(type);
  if (normalized === 'art') {
    if (policy.buckets.art === 'never') return 'never';
    if (policy.buckets.art === 'phase2') return 'phase2';
    return codePointCount(text) >= policy.artMinCodePoints ? 'phase1' : 'phase2';
  }

  if (!normalized) {
    const custom = policy.customTypes.find((entry) => entry.id === type);
    if (custom) return custom.bucket;
    const fromMap = policy.buckets[type];
    if (fromMap) return fromMap;
    return 'phase1';
  }

  return policy.buckets[normalized] ?? 'phase1';
}

export function isPhase1SeedName(
  type: string | null,
  text: string,
  policy: NameTypeTaggingPolicy,
): boolean {
  return bucketForTypedName(type, text, policy) === 'phase1';
}

export function isPhase2SeedName(
  type: string | null,
  text: string,
  policy: NameTypeTaggingPolicy,
): boolean {
  return bucketForTypedName(type, text, policy) === 'phase2';
}

const nfc = (value: string): string => value.normalize('NFC');

/**
 * Phase-1 search strings for a pack or PEDB candidate. When `names` is absent
 * (legacy packs), all `searchStrings` are kept. When present, each string's
 * type is resolved via NFC-normalized lookup.
 */
export function phase1SearchStringsFromCandidate(
  candidate: { searchStrings: string[]; names?: { text: string; type?: string }[] },
  policy: NameTypeTaggingPolicy,
): string[] {
  if (!candidate.names?.length) return candidate.searchStrings;

  const typeByText = new Map<string, string | undefined>();
  for (const name of candidate.names) {
    typeByText.set(nfc(name.text), name.type);
  }

  return candidate.searchStrings.filter((searchString) => {
    const key = nfc(searchString);
    if (!typeByText.has(key)) return true;
    const rawType = typeByText.get(key);
    const resolvedType = rawType !== undefined ? normalizeNameType(rawType ?? null) : null;
    return isPhase1SeedName(resolvedType, searchString, policy);
  });
}

/** Shallow copy with `searchStrings` restricted to phase-1 names; empty when none remain. */
export function filterCandidateForPhase1(
  candidate: AuthorityCandidate,
  policy: NameTypeTaggingPolicy,
): AuthorityCandidate {
  const searchStrings = phase1SearchStringsFromCandidate(candidate, policy);
  return { ...candidate, searchStrings };
}

export type CustomNameTypeIdError = 'invalid_slug' | 'shadows_builtin';

/** Returns an error code, or null when the id is valid. */
export function validateCustomNameTypeId(id: string): CustomNameTypeIdError | null {
  const trimmed = id.trim();
  if (!CUSTOM_ID_RE.test(trimmed)) {
    return 'invalid_slug';
  }
  if (ALL_NAME_TYPES.includes(trimmed as NameTypeId)) {
    return 'shadows_builtin';
  }
  return null;
}

/** Built-in and custom types excluded from phase-1 seeding (phase2 + never). */
export function excludedFromPhase1Types(policy: NameTypeTaggingPolicy): NameTypeId[] {
  return ALL_NAME_TYPES.filter((type) => {
    if (type === 'art') return false;
    const bucket = policy.buckets[type];
    return bucket === 'phase2' || bucket === 'never';
  });
}

export function isNameTypeTaggingPolicy(value: unknown): value is NameTypeTaggingPolicy {
  return (
    typeof value === 'object' &&
    value !== null &&
    'buckets' in value &&
    'artMinCodePoints' in value &&
    'customTypes' in value
  );
}
