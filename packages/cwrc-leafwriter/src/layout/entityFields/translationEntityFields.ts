import { dateFormatSettingsForLang, type DateFormatSettings } from './dateFormatSettings';
import {
  applyPossessiveSuffix,
  displaySpecFromLegacyOverride,
  effectiveTitleConvention,
  EMPTY_DISPLAY_SPEC,
  isEmptyDisplaySpec,
  officeUsesTranslationOnly,
  parseDisplaySpec,
  possessiveStyleForLang,
  resolveEntityParts,
  serializeDisplaySpec,
  shortNameOf,
  workTypeStyle,
  type DisplayFormatOverride,
  type EntityDisplaySpec,
  type EntityPartId,
} from './entityDisplay';
import type { EntitySummary } from './entitySummary';
import type { MentionContext } from './mentionContext';
import {
  deriveDisplaySpec,
  isCharacterOnlyTranslationTarget,
  type MentionRole,
} from './mentionContext';
import { buildCjkMentionParts, buildWesternMentionParts } from './mentionRender';
import {
  fileOccurrenceIndexForUnitInsert,
  collectEntityFieldsInDocumentOrder,
} from './fileWideOccurrence';
import type { MentionRenderPart } from './mentionRender';

export const ENTITY_REF_TYPE = 'ljb-entity';
export const MENTION_SURFACE_ATTR = 'data-mention-surface';
export const MENTION_ROLE_ATTR = 'data-mention-role';
export const ENTITY_FIELD_ATTR = 'data-leaf-entity-field';
/**
 * Marker that this work mention uses citation italics. The attribute itself is
 * not styled — only inner `<hi rend="italic">` runs are, so Chinese and
 * possessive clitics stay upright.
 */
export const ENTITY_WORK_STYLE_ATTR = 'data-work-style';
/** @deprecated Prefer ENTITY_DISPLAY_SPEC_ATTR; kept for older inserts. */
export const ENTITY_DISPLAY_FORMAT_ATTR = 'data-display-format';
export const ENTITY_DISPLAY_SPEC_ATTR = 'data-display-spec';

const LEGACY_OVERRIDES: DisplayFormatOverride[] = [
  'family_only',
  'given_only',
  'full',
  'full_chinese',
  'full_date',
  'title_only',
  'author_only',
];

/** Han-script runs — never italicized or quoted for work titles. */
const HAN_SPLIT_RE = /(\p{Script=Han}+)/u;

const parseLegacyOverride = (raw: string | null): DisplayFormatOverride | null => {
  if (!raw) return null;
  return (LEGACY_OVERRIDES as string[]).includes(raw) ? (raw as DisplayFormatOverride) : null;
};

/** Read the compositional spec from a field element (spec attr wins over legacy). */
export const readDisplaySpecFromField = (field: Element): EntityDisplaySpec => {
  const fromSpec = parseDisplaySpec(field.getAttribute(ENTITY_DISPLAY_SPEC_ATTR));
  if (fromSpec) return fromSpec;
  const fromLegacy = displaySpecFromLegacyOverride(
    parseLegacyOverride(field.getAttribute(ENTITY_DISPLAY_FORMAT_ATTR)),
  );
  return fromLegacy ?? EMPTY_DISPLAY_SPEC;
};

/** Write (or clear) the display spec on a field; drops the legacy format attr. */
export const writeDisplaySpecToField = (field: Element, spec: EntityDisplaySpec): void => {
  field.removeAttribute(ENTITY_DISPLAY_FORMAT_ATTR);
  const serialized = serializeDisplaySpec(spec);
  if (serialized) field.setAttribute(ENTITY_DISPLAY_SPEC_ATTR, serialized);
  else field.removeAttribute(ENTITY_DISPLAY_SPEC_ATTR);
};

const isRomanizationNamePart = (id: EntityPartId): boolean =>
  id === 'family' || id === 'given' || id === 'name';

const isParenPart = (id: EntityPartId): boolean =>
  id === 'dates' || id === 'translation' || id === 'original';

/**
 * Append text, optionally wrapping non-Han runs in italics or curly quotes.
 * Chinese (Han) characters stay upright / outside the quotes.
 */
const appendStyledRuns = (
  parent: Element,
  text: string,
  mode: 'plain' | 'italic' | 'quote',
): void => {
  const doc = parent.ownerDocument ?? document;
  if (mode === 'plain' || !text) {
    if (text) parent.appendChild(doc.createTextNode(text));
    return;
  }

  const pieces = text.split(HAN_SPLIT_RE);
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (!piece) continue;
    // Capturing split: odd indexes are Han runs.
    const isHan = index % 2 === 1;
    if (isHan) {
      parent.appendChild(doc.createTextNode(piece));
      continue;
    }
    if (mode === 'italic') {
      const hi = doc.createElement('hi');
      hi.setAttribute('rend', 'italic');
      hi.textContent = piece;
      parent.appendChild(hi);
      continue;
    }
    // quote — wrap this non-Han run in curly quotes
    parent.appendChild(doc.createTextNode(`“${piece}”`));
  }
};

/**
 * Fill an entity field from the display recipe. Work-type italics/quotes apply
 * to the leading title part (romanization under romanization-first; gloss under
 * translation-first) — never to Chinese, original-forms paren, dates, or ’s.
 */
const applyWorkTypeStyle = (
  field: Element,
  entity: EntitySummary,
  occurrenceIndex: number,
  spec: EntityDisplaySpec,
  settings: DateFormatSettings,
  lang?: string | null,
): void => {
  const style = workTypeStyle(entity);
  if (style === 'italic') field.setAttribute(ENTITY_WORK_STYLE_ATTR, 'italic');
  else field.removeAttribute(ENTITY_WORK_STYLE_ATTR);

  while (field.firstChild) field.removeChild(field.firstChild);

  const parts = resolveEntityParts(entity, occurrenceIndex, spec, settings, lang);
  const doc = field.ownerDocument ?? document;
  if (parts.length === 0) {
    appendStyledRuns(field, shortNameOf(entity), style ?? 'plain');
    return;
  }

  const possessiveStyle = possessiveStyleForLang(lang);
  let possessiveApplied = false;
  const translationFirst =
    parts[0]?.id === 'translation' &&
    (officeUsesTranslationOnly(entity, spec, lang) ||
      effectiveTitleConvention(spec, lang, entity.kind) === 'translation-first');

  parts.forEach((part, index) => {
    if (index > 0) field.appendChild(doc.createTextNode(' '));

    const leadTranslation = translationFirst && part.id === 'translation';
    let open = '';
    let close = '';
    if (isParenPart(part.id) && !leadTranslation) {
      if (spec.bracketsAround === part.id) {
        open = '[';
        close = ']';
      } else {
        open = '(';
        close = ')';
      }
    } else if (spec.bracketsAround === part.id) {
      open = '[';
      close = ']';
    }

    const next = parts[index + 1];
    const isPossessiveTarget = leadTranslation || isRomanizationNamePart(part.id);
    const nextIsPossessiveTarget = Boolean(
      next &&
      (isRomanizationNamePart(next.id) ||
        (translationFirst && next.id === 'translation' && index === 0)),
    );
    let suffix = '';
    if (
      spec.possessive &&
      possessiveStyle !== 'none' &&
      isPossessiveTarget &&
      !nextIsPossessiveTarget &&
      !possessiveApplied
    ) {
      const full = applyPossessiveSuffix(part.text, possessiveStyle);
      suffix = full.slice(part.text.length);
      possessiveApplied = true;
    }

    // Citation styling on the leading title only.
    const titleMode =
      style && (leadTranslation || (!translationFirst && isRomanizationNamePart(part.id)))
        ? style
        : ('plain' as const);

    if (open) field.appendChild(doc.createTextNode(open));
    appendStyledRuns(field, part.text, titleMode);
    if (close) field.appendChild(doc.createTextNode(close));
    if (suffix) field.appendChild(doc.createTextNode(suffix));
  });
};

export const createEntityFieldElement = (
  entity: EntitySummary,
  occurrenceIndex: number,
  spec: EntityDisplaySpec = EMPTY_DISPLAY_SPEC,
  settings?: DateFormatSettings | null,
  lang?: string | null,
): HTMLElement => {
  const resolved = settings ?? dateFormatSettingsForLang(lang);
  const ref = document.createElement('ref');
  ref.setAttribute('type', ENTITY_REF_TYPE);
  ref.setAttribute('key', entity.id);
  ref.setAttribute('contenteditable', 'false');
  ref.setAttribute(ENTITY_FIELD_ATTR, 'true');
  ref.setAttribute('title', `${entity.kind}: ${entity.id}`);
  writeDisplaySpecToField(ref, spec);
  applyWorkTypeStyle(ref, entity, occurrenceIndex, spec, resolved, lang);
  return ref;
};

export const createMentionFieldElement = (
  entity: EntitySummary,
  mention: MentionContext,
  parts: MentionRenderPart[],
  displaySpec: EntityDisplaySpec,
): HTMLElement => {
  const ref = document.createElement('ref');
  ref.setAttribute('type', ENTITY_REF_TYPE);
  ref.setAttribute('key', entity.id);
  ref.setAttribute('contenteditable', 'false');
  ref.setAttribute(ENTITY_FIELD_ATTR, 'true');
  ref.setAttribute('title', `${entity.kind}: ${entity.id}`);
  ref.setAttribute(MENTION_SURFACE_ATTR, mention.surface);
  ref.setAttribute(MENTION_ROLE_ATTR, mention.role);
  writeDisplaySpecToField(ref, displaySpec);
  applyMentionPartsToField(ref, parts);
  return ref;
};

export const applyMentionPartsToField = (ref: Element, parts: MentionRenderPart[]): void => {
  while (ref.firstChild) ref.removeChild(ref.firstChild);
  const doc = ref.ownerDocument ?? document;

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (i > 0 && part.id !== 'bracket-family-han' && parts[i - 1]?.id !== 'bracket-family-han') {
      ref.appendChild(doc.createTextNode(' '));
    }

    if (part.id === 'bracket-family-han' && part.useBrackets) {
      ref.appendChild(doc.createTextNode(`（${part.text}）`));
      continue;
    }

    const span = doc.createElement('span');
    span.setAttribute(
      'data-entity-part',
      part.id === 'surface' || part.id === 'bracket-family-han' ? 'chinese' : part.id,
    );

    if (part.useBrackets) span.textContent = `[${part.text}]`;
    else if (part.useParen) span.textContent = `(${part.text})`;
    else span.textContent = part.text;

    ref.appendChild(span);
  }
};

export const prepareAtomicEntityFields = (root: ParentNode): void => {
  for (const ref of Array.from(
    (
      root as ParentNode & { querySelectorAll: typeof Element.prototype.querySelectorAll }
    ).querySelectorAll?.(`ref[type="${ENTITY_REF_TYPE}"]`) ?? [],
  )) {
    ref.setAttribute('contenteditable', 'false');
    ref.setAttribute(ENTITY_FIELD_ATTR, 'true');
    if (!ref.getAttribute('title')) {
      ref.setAttribute('title', ref.getAttribute('key') ?? 'Entity');
    }
  }
};

/**
 * Re-render every entity field for `entityId` in document order (1-based),
 * preserving each field's stored display recipe.
 */
export const recalculateEntityFieldsInRoot = (
  root: ParentNode,
  entityId: string,
  entity: EntitySummary,
  settings?: DateFormatSettings | null,
  lang?: string | null,
  options?: {
    translationDoc?: Document | null;
    alignmentUnit?: 'div' | 'p' | 'ab';
    sourceFileName?: string;
    unitId?: string;
    /** Project source language — used to romanize mention surfaces (zh → pinyin). */
    sourceLang?: string | null;
  },
): void => {
  const resolved = settings ?? dateFormatSettingsForLang(lang);
  const host = root as ParentNode & {
    querySelectorAll?: typeof Element.prototype.querySelectorAll;
  };
  const fields = Array.from(host.querySelectorAll?.(`ref[type="${ENTITY_REF_TYPE}"]`) ?? []).filter(
    (field) => field.getAttribute('key') === entityId,
  );

  const fileOrdered =
    options?.translationDoc && options.alignmentUnit && options.sourceFileName
      ? collectEntityFieldsInDocumentOrder(
          options.translationDoc,
          options.alignmentUnit,
          options.sourceFileName,
        ).filter((ref) => ref.entityKey === entityId)
      : null;

  fields.forEach((field, index) => {
    const surface = field.getAttribute(MENTION_SURFACE_ATTR);
    const roleAttr = field.getAttribute(MENTION_ROLE_ATTR) as MentionRole | null;

    if (surface != null && roleAttr) {
      const mention: MentionContext = {
        index,
        key: entityId,
        kind: entity.kind,
        surface,
        teiTag: 'persName',
        teiType: null,
        role: roleAttr,
        placeholderRole: 'entity',
      };
      let fileOccurrenceIndex = index + 1;
      if (fileOrdered && options?.unitId) {
        const prior = fileOrdered.filter(
          (ref) => ref.unitId !== options.unitId || ref.field !== field,
        ).length;
        const within = fields.slice(0, index + 1).indexOf(field) + 1;
        fileOccurrenceIndex = prior + within;
      } else if (
        options?.translationDoc &&
        options.unitId &&
        options.alignmentUnit &&
        options.sourceFileName
      ) {
        fileOccurrenceIndex = fileOccurrenceIndexForUnitInsert(
          options.translationDoc,
          options.alignmentUnit,
          options.sourceFileName,
          options.unitId,
          entityId,
          index,
        );
      }
      const displaySpec = deriveDisplaySpec(
        mention.role,
        fileOccurrenceIndex,
        resolved.bracketsPolicy,
        readDisplaySpecFromField(field),
      );
      const parts: MentionRenderPart[] = isCharacterOnlyTranslationTarget(lang)
        ? buildCjkMentionParts(mention, entity, fileOccurrenceIndex, displaySpec, resolved, lang)
        : buildWesternMentionParts(
            mention,
            entity,
            fileOccurrenceIndex,
            displaySpec,
            resolved,
            options?.sourceLang,
            lang,
          );
      writeDisplaySpecToField(field, displaySpec);
      applyMentionPartsToField(field, parts);
      field.setAttribute('contenteditable', 'false');
      field.setAttribute(ENTITY_FIELD_ATTR, 'true');
      return;
    }

    const spec = readDisplaySpecFromField(field);
    applyWorkTypeStyle(field, entity, index + 1, spec, resolved, lang);
    field.setAttribute('contenteditable', 'false');
    field.setAttribute(ENTITY_FIELD_ATTR, 'true');
    if (!isEmptyDisplaySpec(spec)) writeDisplaySpecToField(field, spec);
  });
};

export const recalculateAllEntityFieldsInRoot = async (
  root: ParentNode,
  fetchEntity: (id: string) => Promise<EntitySummary | null>,
  settings?: DateFormatSettings | null,
  lang?: string | null,
): Promise<void> => {
  const resolved = settings ?? dateFormatSettingsForLang(lang);
  const fields = Array.from(
    (
      root as ParentNode & { querySelectorAll: typeof Element.prototype.querySelectorAll }
    ).querySelectorAll?.(`ref[type="${ENTITY_REF_TYPE}"][key]`) ?? [],
  );
  const ids = [
    ...new Set(
      fields.map((field) => field.getAttribute('key')).filter((key): key is string => Boolean(key)),
    ),
  ];
  for (const id of ids) {
    const entity = await fetchEntity(id);
    if (!entity) continue;
    recalculateEntityFieldsInRoot(root, id, entity, resolved, lang);
  }
};
