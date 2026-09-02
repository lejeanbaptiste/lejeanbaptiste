/**
 * Mention-faithful rendering for Western and CJK translation targets.
 */

import type { EntityDates } from './entitySummary';
import type { EntitySummary } from './entitySummary';
import {
  familyAndGivenOf,
  formatDates,
  officeUsesTranslationOnly,
  translatedNameOf,
  type EntityDisplaySpec,
  type EntityPartId,
  type ResolvedEntityPart,
} from './entityDisplay';
import type { BracketsPolicy, DateFormatSettings } from './dateFormatSettings';
import type { MentionContext, MentionRole } from './mentionContext';
import { romanizeMentionSurface } from './mentionContext';
import { familyHanForEntity, normalizeSurfaceForTargetLang } from './scriptNormalize';

export interface MentionRenderPart {
  id: EntityPartId | 'surface' | 'bracket-family-han';
  text: string;
  useBrackets?: boolean;
  useParen?: boolean;
}

const normalizedSurfaceText = (text: string): string => text.normalize('NFC').trim();

/** Skip the Chinese suffix when a name part already shows the same characters. */
export const shouldAppendChinesePart = (parts: MentionRenderPart[], surface: string): boolean => {
  const norm = normalizedSurfaceText(surface);
  if (!norm) return false;
  return !parts.some((part) => part.id !== 'dates' && normalizedSurfaceText(part.text) === norm);
};

const astronomicalToHistorical = (isoYear: number): number =>
  isoYear <= 0 ? 1 - isoYear : isoYear;

const formatCjkYear = (isoYear: number, settings: DateFormatSettings): string => {
  const display = astronomicalToHistorical(isoYear);
  const bce = isoYear <= 0;
  const prefix = bce ? (settings.bcePrefix ?? '前') : '';
  return `${prefix}${display}`;
};

/** Western calendar years in CJK typography: （127～200年）, （卒於89年）. */
export const formatEntityDatesCjk = (
  dates: EntityDates | null,
  settings: DateFormatSettings,
): string | null => {
  if (!dates) return null;
  const { startYear, endYear, endPrecision } = dates;
  const open = settings.parenOpen ?? '（';
  const close = settings.parenClose ?? '）';
  const sep = settings.rangeSeparator ?? '～';
  const suffix = settings.yearSuffix ?? '年';

  if (startYear != null && endYear != null) {
    const a = formatCjkYear(startYear, settings);
    const b = formatCjkYear(endYear, settings);
    return `${open}${a}${sep}${b}${suffix}${close}`;
  }
  if (endYear != null && (endPrecision?.startsWith('d') || !startYear)) {
    const word = settings.deathWord ?? '卒於';
    const y = formatCjkYear(endYear, settings);
    return `${open}${word}${y}${suffix}${close}`;
  }
  if (startYear != null) {
    const word = settings.birthWord ?? '生於';
    const y = formatCjkYear(startYear, settings);
    return `${open}${word}${y}${suffix}${close}`;
  }
  if (endYear != null) {
    const word = settings.deathWord ?? '卒於';
    const y = formatCjkYear(endYear, settings);
    return `${open}${word}${y}${suffix}${close}`;
  }
  return null;
};

const westernPartsForPartial = (
  mention: MentionContext,
  entity: EntitySummary,
  spec: EntityDisplaySpec,
  sourceLang: string | null | undefined,
): MentionRenderPart[] => {
  const given = romanizeMentionSurface(mention, entity, sourceLang);
  const { family } = familyAndGivenOf(entity);
  const parts: MentionRenderPart[] = [];
  if (spec.bracketsAround === 'family' && family) {
    parts.push({ id: 'family', text: family, useBrackets: true });
    parts.push({ id: 'given', text: given });
  } else {
    parts.push({ id: 'given', text: given });
  }
  return parts;
};

const westernPartsForFull = (
  mention: MentionContext,
  entity: EntitySummary,
  fileOccurrenceIndex: number,
  sourceLang: string | null | undefined,
): MentionRenderPart[] => {
  const parts: MentionRenderPart[] = [];
  if (entity.kind === 'person') {
    const { family, given } = familyAndGivenOf(entity);
    if (family) parts.push({ id: 'family', text: family });
    if (given) parts.push({ id: 'given', text: given });
    else parts.push({ id: 'name', text: romanizeMentionSurface(mention, entity, sourceLang) });
  } else {
    parts.push({
      id: 'name',
      text: romanizeMentionSurface(mention, entity, sourceLang),
    });
  }
  if (fileOccurrenceIndex <= 1 && shouldAppendChinesePart(parts, mention.surface)) {
    parts.push({ id: 'chinese', text: mention.surface });
  }
  return parts;
};

const westernPartsForAsWritten = (
  mention: MentionContext,
  entity: EntitySummary,
  fileOccurrenceIndex: number,
  spec: EntityDisplaySpec,
  sourceLang: string | null | undefined,
  targetLang: string | null | undefined,
): MentionRenderPart[] => {
  // Offices with a vernacular gloss: translation alone (no pinyin / characters),
  // matching resolveEntityParts / officeUsesTranslationOnly. Override to
  // romanization-first on the mention spec to show pinyin + Chinese instead.
  if (mention.role === 'office-as-written' && officeUsesTranslationOnly(entity, spec, targetLang)) {
    const gloss = translatedNameOf(entity, targetLang);
    if (gloss) return [{ id: 'translation', text: gloss }];
  }

  const parts: MentionRenderPart[] = [
    {
      id: 'name',
      text: romanizeMentionSurface(mention, entity, sourceLang),
    },
  ];
  if (fileOccurrenceIndex <= 1 && shouldAppendChinesePart(parts, mention.surface)) {
    parts.push({ id: 'chinese', text: mention.surface });
  }
  return parts;
};

export const buildWesternMentionParts = (
  mention: MentionContext,
  entity: EntitySummary,
  fileOccurrenceIndex: number,
  spec: EntityDisplaySpec,
  settings: DateFormatSettings,
  sourceLang?: string | null,
  targetLang?: string | null,
): MentionRenderPart[] => {
  let parts: MentionRenderPart[];

  switch (mention.role) {
    case 'courtesy':
    case 'dharma':
      parts = [
        {
          id: 'given',
          text: romanizeMentionSurface(mention, entity, sourceLang),
        },
      ];
      // Alternate name forms always keep characters — file-occurrence shortening
      // is for the same *surface* repeating, not “2nd chip of this person key”
      // (otherwise 景撝 after 蔡約 loses its Han).
      if (shouldAppendChinesePart(parts, mention.surface)) {
        parts.push({ id: 'chinese', text: mention.surface });
      }
      break;
    case 'partial-given':
      parts = westernPartsForPartial(mention, entity, spec, sourceLang);
      if (shouldAppendChinesePart(parts, mention.surface)) {
        parts.push({ id: 'chinese', text: mention.surface });
      }
      break;
    case 'place-as-written':
    case 'office-as-written':
    case 'work-as-written':
    case 'org-as-written':
      parts = westernPartsForAsWritten(
        mention,
        entity,
        fileOccurrenceIndex,
        spec,
        sourceLang,
        targetLang,
      );
      break;
    default:
      parts = westernPartsForFull(mention, entity, fileOccurrenceIndex, sourceLang);
  }

  if (fileOccurrenceIndex <= 1 && entity.dates && entity.kind === 'person') {
    const dates = formatDates(entity.dates, settings);
    if (dates) parts.push({ id: 'dates', text: dates, useParen: true });
  }

  return parts;
};

export const buildCjkMentionParts = (
  mention: MentionContext,
  entity: EntitySummary,
  fileOccurrenceIndex: number,
  spec: EntityDisplaySpec,
  settings: DateFormatSettings,
  targetLang: string | null | undefined,
): MentionRenderPart[] => {
  const surface = normalizeSurfaceForTargetLang(mention.surface, targetLang);
  const parts: MentionRenderPart[] = [];

  if (mention.role === 'partial-given' && spec.bracketsAround === 'family') {
    const familyHan = familyHanForEntity(entity);
    if (familyHan) {
      const fam = normalizeSurfaceForTargetLang(familyHan, targetLang);
      parts.push({ id: 'bracket-family-han', text: fam });
    }
  }

  parts.push({ id: 'surface', text: surface });

  if (fileOccurrenceIndex <= 1 && entity.dates && entity.kind === 'person') {
    const dates = formatEntityDatesCjk(entity.dates, settings);
    if (dates) parts.push({ id: 'dates', text: dates });
  }

  return parts;
};

export const mentionPartsToPlainPreview = (parts: MentionRenderPart[]): string =>
  parts
    .map((part, index) => {
      if (part.id === 'bracket-family-han') return `（${part.text}）`;
      let text = part.text;
      if (part.useBrackets) text = `[${text}]`;
      else if (part.useParen) text = `(${text})`;
      const prev = parts[index - 1];
      const glue = prev?.id === 'bracket-family-han' ? '' : index > 0 ? ' ' : '';
      return `${glue}${text}`;
    })
    .join('');

export const resolvedPartsFromMention = (parts: MentionRenderPart[]): ResolvedEntityPart[] =>
  parts.map((part) => ({
    id: (part.id === 'surface' || part.id === 'bracket-family-han'
      ? 'chinese'
      : part.id) as EntityPartId,
    text: part.text,
  }));

export const shouldUseCjkBracketsForPartial = (
  role: MentionRole,
  policy: BracketsPolicy,
  fileOccurrenceIndex: number,
): boolean => {
  if (role !== 'partial-given' || policy === 'never') return false;
  if (policy === 'always') return true;
  return fileOccurrenceIndex <= 1;
};
