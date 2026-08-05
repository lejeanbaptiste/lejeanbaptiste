import {
  dateFormatSettingsForLang,
  type DateFormatSettings,
} from './dateFormatSettings';
import {
  displaySpecFromLegacyOverride,
  EMPTY_DISPLAY_SPEC,
  isEmptyDisplaySpec,
  parseDisplaySpec,
  renderEntityFromSpec,
  serializeDisplaySpec,
  type DisplayFormatOverride,
  type EntityDisplaySpec,
} from './entityDisplay';
import type { EntitySummary } from './entitySummary';

export const ENTITY_REF_TYPE = 'ljb-entity';
export const ENTITY_FIELD_ATTR = 'data-leaf-entity-field';
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
  ref.textContent = renderEntityFromSpec(entity, occurrenceIndex, spec, resolved, lang);
  return ref;
};

export const prepareAtomicEntityFields = (root: ParentNode): void => {
  for (const ref of Array.from(
    (root as ParentNode & { querySelectorAll: typeof Element.prototype.querySelectorAll }).querySelectorAll?.(
      `ref[type="${ENTITY_REF_TYPE}"]`,
    ) ?? [],
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
): void => {
  const resolved = settings ?? dateFormatSettingsForLang(lang);
  const host = root as ParentNode & {
    querySelectorAll?: typeof Element.prototype.querySelectorAll;
  };
  const fields = Array.from(host.querySelectorAll?.(`ref[type="${ENTITY_REF_TYPE}"]`) ?? []).filter(
    (field) => field.getAttribute('key') === entityId,
  );
  fields.forEach((field, index) => {
    const spec = readDisplaySpecFromField(field);
    field.textContent = renderEntityFromSpec(entity, index + 1, spec, resolved, lang);
    field.setAttribute('contenteditable', 'false');
    field.setAttribute(ENTITY_FIELD_ATTR, 'true');
    // Normalize storage: migrate legacy format attrs into data-display-spec.
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
    (root as ParentNode & { querySelectorAll: typeof Element.prototype.querySelectorAll }).querySelectorAll?.(
      `ref[type="${ENTITY_REF_TYPE}"][key]`,
    ) ?? [],
  );
  const ids = [
    ...new Set(
      fields
        .map((field) => field.getAttribute('key'))
        .filter((key): key is string => Boolean(key)),
    ),
  ];
  for (const id of ids) {
    const entity = await fetchEntity(id);
    if (!entity) continue;
    recalculateEntityFieldsInRoot(root, id, entity, resolved, lang);
  }
};
