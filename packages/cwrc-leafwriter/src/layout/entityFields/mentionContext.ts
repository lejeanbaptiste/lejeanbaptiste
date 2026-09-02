/**
 * Mention-faithful entity rendering: one manifest row per keyed source span.
 */

import {
  isChineseLanguageCode,
  isJapaneseLanguageCode,
  isKoreanLanguageCode,
} from '../../utilities/languageCodes';
import { autoRomanize, autoRomanizeForKind, isLatinScript } from '../../utilities/romanize';
import {
  chineseNameOf,
  familyAndGivenOf,
  romanizedNameOf,
  shortNameOf,
  type EntityDisplaySpec,
} from './entityDisplay';
import type { BracketsPolicy } from './dateFormatSettings';
import type { EntitySummary } from './entitySummary';
import { SOURCE_UNIT_ENTITY_TAGS, elementsByLocalName } from './mentionCollectShared';
import { replaceEntitiesWithPlaceholdersInSourceXml } from './sourceUnitEntities';

export type { BracketsPolicy };

export type MentionRole =
  | 'full-name'
  | 'courtesy'
  | 'partial-given'
  | 'dharma'
  | 'place-as-written'
  | 'office-as-written'
  | 'work-as-written'
  | 'org-as-written';

export type MentionPlaceholderRole = 'entity' | 'holding' | 'as';

export interface MentionContext {
  index: number;
  key: string;
  kind: string;
  surface: string;
  teiTag: string;
  teiType: string | null;
  role: MentionRole;
  placeholderRole: MentionPlaceholderRole;
}

export const MENTION_SURFACE_ATTR = 'data-mention-surface';
export const MENTION_ROLE_ATTR = 'data-mention-role';

const DHARMA_TYPES = new Set(['dharma', 'religious', 'monastic', '法名', '僧名']);
const COURTESY_TYPES = new Set(['courtesy', 'zi', 'style', '字']);

const isMostlyCjk = (text: string): boolean => /[\u3400-\u9FFF]/.test(text);

const cjkNameRowForSurface = (
  entity: EntitySummary,
  surface: string,
): { text: string; type: string | null; role: string | null } | null => {
  const normalized = surface.trim();
  if (!normalized) return null;
  return (entity.names.find(
    (name) =>
      name.text?.trim() === normalized ||
      name.text?.normalize('NFC').trim() === normalized.normalize('NFC'),
  ) ?? null) as { text: string; type: string | null; role: string | null } | null;
};

const isPartialGivenPerson = (entity: EntitySummary, surface: string): boolean => {
  if (entity.kind !== 'person' || !isMostlyCjk(surface)) return false;
  const chinese = chineseNameOf(entity);
  if (chinese && chinese === surface) return false;
  const familyHan = entity.names.find(
    (n) => n.role === 'family' && isMostlyCjk(n.text ?? ''),
  )?.text;
  if (familyHan && surface.includes(familyHan)) return false;
  const { given } = familyAndGivenOf(entity);
  if (given && surface === given) return true;
  if (chinese && chinese.endsWith(surface) && chinese.length > surface.length) return true;
  if (chinese && !chinese.includes(surface) && surface.length <= 3) return true;
  return false;
};

/** True when the companion target language shows characters only (no romanization). */
export const isCharacterOnlyTranslationTarget = (lang: string | null | undefined): boolean =>
  isChineseLanguageCode(lang) || isJapaneseLanguageCode(lang) || isKoreanLanguageCode(lang);

export const resolveMentionRole = (
  mention: Pick<MentionContext, 'kind' | 'surface' | 'teiTag' | 'teiType'>,
  entity: EntitySummary | null,
): MentionRole => {
  const teiType = (mention.teiType ?? '').trim().toLowerCase();
  const surface = mention.surface.trim();

  if (mention.kind === 'place') return 'place-as-written';
  if (mention.kind === 'office') return 'office-as-written';
  if (mention.kind === 'work') return 'work-as-written';
  if (mention.kind === 'org') return 'org-as-written';

  if (!entity || entity.kind !== 'person') return 'full-name';

  if (COURTESY_TYPES.has(teiType) || teiType === 'courtesy') return 'courtesy';

  const matched = entity ? cjkNameRowForSurface(entity, surface) : null;
  if (matched) {
    const role = (matched.role ?? matched.type ?? '').toLowerCase();
    if (COURTESY_TYPES.has(role) || role === 'courtesy') return 'courtesy';
    if (DHARMA_TYPES.has(role) || DHARMA_TYPES.has((matched.type ?? '').toLowerCase()))
      return 'dharma';
  }

  if (entity) {
    for (const name of entity.names) {
      const role = (name.role ?? name.type ?? '').toLowerCase();
      if (name.text?.trim() === surface) {
        if (COURTESY_TYPES.has(role) || role === 'courtesy') return 'courtesy';
        if (DHARMA_TYPES.has(role)) return 'dharma';
      }
    }
  }

  if (entity && isPartialGivenPerson(entity, surface)) return 'partial-given';
  return 'full-name';
};

export const deriveDisplaySpec = (
  role: MentionRole,
  fileOccurrenceIndex: number,
  policy: BracketsPolicy,
  existing?: EntityDisplaySpec | null,
): EntityDisplaySpec => {
  if (existing && (existing.bracketsAround || existing.hidden.length > 0)) return existing;

  const base: EntityDisplaySpec = {
    hidden: [],
    extraParts: [],
    bracketsAround: null,
    possessive: false,
    titleConvention: null,
  };

  if (role !== 'partial-given' || policy === 'never') return base;

  const showBrackets =
    policy === 'always' || (policy === 'first-mention-only' && fileOccurrenceIndex <= 1);

  if (showBrackets) return { ...base, bracketsAround: 'family' };
  return base;
};

/** Languages to try for CJK→Latin conversion (target langs like en/fr are skipped). */
const romanizationLangCandidates = (sourceLang?: string | null): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (code: string | null | undefined) => {
    const trimmed = code?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  add(sourceLang);
  add('zh');
  add('zh-Hant');
  return out;
};

const autoRomanizeWithLangFallback = (
  surface: string,
  sourceLang: string | null | undefined,
  kind: string | null | undefined,
  options?: { concatenate?: boolean },
): string | null => {
  for (const lang of romanizationLangCandidates(sourceLang)) {
    // `concatenate` must win over kind-aware spacing — given names / name parts
    // are one word (Xingzong), while autoRomanizeForKind('person') spaces syllables.
    const result = options?.concatenate
      ? autoRomanize(surface, lang, { concatenate: true })
      : kind
        ? autoRomanizeForKind(surface, lang, kind)
        : autoRomanize(surface, lang, options);
    if (result) return result;
  }
  return null;
};

const storedLatinRomanization = (entity: EntitySummary): string | null => {
  const stored = romanizedNameOf(entity);
  return stored && isLatinScript(stored) ? stored : null;
};

/** One Capitalized word for any person name part (family, given, zi, hao, dharma, posthumous…). */
const romanizePersonNamePart = (surface: string, sourceLang?: string | null): string | null =>
  autoRomanizeWithLangFallback(surface, sourceLang, null, { concatenate: true });

export const romanizeMentionSurface = (
  mention: Pick<MentionContext, 'surface' | 'kind' | 'role'>,
  entity: EntitySummary,
  sourceLang?: string | null,
): string => {
  const surface = mention.surface.trim();
  if (!surface) return shortNameOf(entity);

  // All person-name forms in the DB are one concatenated pinyin word with a
  // single capital: 興宗 → Xingzong, 景撝 → Jinghui, 法號 → Faming, etc.
  if (
    mention.role === 'courtesy' ||
    mention.role === 'dharma' ||
    mention.role === 'partial-given'
  ) {
    const fromSurface = romanizePersonNamePart(surface, sourceLang);
    if (fromSurface) return fromSurface;
    const row = cjkNameRowForSurface(entity, surface);
    if (row) {
      const fromDb = romanizePersonNamePart(row.text, sourceLang);
      if (fromDb) return fromDb;
    }
    return surface;
  }

  if (mention.role.endsWith('-as-written')) {
    return (
      autoRomanizeWithLangFallback(surface, sourceLang, mention.kind) ??
      storedLatinRomanization(entity) ??
      surface
    );
  }

  if (mention.role === 'full-name' && entity.kind === 'person') {
    return shortNameOf(entity);
  }

  if (entity.kind === 'person') {
    return (
      romanizePersonNamePart(surface, sourceLang) ??
      storedLatinRomanization(entity) ??
      shortNameOf(entity)
    );
  }

  return (
    autoRomanizeWithLangFallback(surface, sourceLang, entity.kind) ??
    storedLatinRomanization(entity) ??
    shortNameOf(entity)
  );
};

/**
 * Collect keyed spans in document order (one row per mention, keys may repeat).
 * Uses the same walk as blinding so manifest indices match `{{mention:N}}`.
 */
export const collectMentionsFromSourceUnitXml = (sourceUnitXml: string): MentionContext[] => {
  if (!sourceUnitXml.trim()) return [];
  const doc = new DOMParser().parseFromString(sourceUnitXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];

  const keys = new Set<string>();
  for (const tag of SOURCE_UNIT_ENTITY_TAGS) {
    for (const el of elementsByLocalName(doc, tag)) {
      const key = el.getAttribute('key')?.trim();
      if (key) keys.add(key);
    }
  }
  for (const el of elementsByLocalName(doc, 'name')) {
    if (el.getAttribute('type') !== 'personWrapper') continue;
    const key = el.getAttribute('key')?.trim();
    if (key) keys.add(key);
  }

  return replaceEntitiesWithPlaceholdersInSourceXml(sourceUnitXml, keys).mentions;
};

export const resolveMentionsWithEntities = (
  mentions: MentionContext[],
  entities: Map<string, EntitySummary>,
): MentionContext[] =>
  mentions.map((mention) => {
    const entity = entities.get(mention.key) ?? null;
    return { ...mention, role: resolveMentionRole(mention, entity) };
  });
