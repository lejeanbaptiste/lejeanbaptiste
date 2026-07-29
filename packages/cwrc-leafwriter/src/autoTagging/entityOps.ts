/**
 * Read/modify operations over the entity database document for the database
 * panel (Phase 6): listing, descriptions, alternative names, authority
 * attach/detach, merge, delete, and duplicate-authority detection. All
 * functions mutate the passed Document; the caller persists via EntityStore.
 */

import { isLatnLang, latnLangFor } from '../utilities/languageCodes';
import {
  CENTRAL_IDNO_TYPE,
  getCentralId,
  listCentralMappings,
  setCentralMapping,
} from './concordance';
import {
  ENTITY_KINDS,
  appendAuthorityIdnos,
  entityElements,
  entityKindOfElement,
  findEntity,
  isoYearString,
  parseIsoYear,
  touchEntity,
  type AuthorityId,
  type EntityKind,
} from './entities';
import {
  entityValueKey,
  readEntityValueProvenance,
  writeEntityValueProvenance,
  type EntityValueOrigin,
  type EntityValueStatus,
} from './entityProvenance';
import {
  isPhase1SeedName,
  isNameTypeTaggingPolicy,
  type NameTypeTaggingPolicy,
} from './nameTypeTaggingPolicy';
import { isTaggableNameType, normalizeNameType, type NameTypeId } from './nameTypes';
import { canonicalNationalityLabel } from './dynastyCrosswalk';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

export const DUPLICATE_OK_NOTE_TYPE = 'duplicate-ok';
export const CONCORDANCE_REJECTED_NOTE_TYPE = 'concordance-rejected';

export interface ConcordanceAssociation {
  source: string;
  canonicalId: string;
  mergedFromId: string;
  notes?: string;
  sourceRef?: string;
}

export interface ConcordanceRejection {
  source: string;
  leftId: string;
  rightId: string;
  reason: string | null;
  entityId: string | null;
}

export interface ConcordanceImportResult {
  applied: number;
  alreadyPresent: number;
  rejected: number;
  unresolved: number;
  conflicts: { association: ConcordanceAssociation; entityIds: string[] }[];
}

export interface NameEntry {
  text: string;
  /** xml:lang of the name element; null on legacy attribute-less names. */
  lang: string | null;
  /** Canonical name type from @type; null when absent or unrecognized. */
  type: NameTypeId | null;
}

export interface EntitySummary {
  id: string;
  kind: EntityKind;
  /** All name strings; the first is the display name. */
  names: string[];
  /** Same names in the same order, with xml:lang and @type. */
  nameEntries: NameEntry[];
  /** First Latin-script (…-Latn) name, e.g. the stored romanization. */
  romanized: string | null;
  description: string | null;
  authorities: AuthorityId[];
  /** Person's family name (surname), stored separately from the display name. Persons only. */
  familyName: string | null;
  /** Person's given name, stored separately from the display name. Persons only. */
  givenName: string | null;
  startYear: number | null;
  endYear: number | null;
  nationalities: string[];
  placesOfOrigin: string[];
  /** Origins represented by active field values on this entity. */
  origins: EntityValueOrigin[];
  rejectedCount: number;
  rejectedAssertions: { element: string; value: string; source: string | null }[];
  rejectedConcordances: ConcordanceRejection[];
  assertions: EntityAssertionSummary[];
}

export const kindOfElement = entityKindOfElement;

const nameElements = (item: Element, kind: EntityKind): Element[] => {
  const tag = ENTITY_KINDS[kind].name;
  return Array.from(item.children).filter((child) => child.localName === tag);
};

const noteOfType = (item: Element, type: string): Element | null =>
  Array.from(item.children).find(
    (child) => child.localName === 'note' && child.getAttribute('type') === type,
  ) ?? null;

const familyNameNote = (item: Element): Element | null => noteOfType(item, 'familyName');
const givenNameNote = (item: Element): Element | null => noteOfType(item, 'givenName');

const activeNotesOfType = (item: Element, type: string): Element[] =>
  Array.from(item.children).filter(
    (child) =>
      child.localName === 'note' &&
      child.getAttribute('type') === type &&
      readEntityValueProvenance(child).status === 'active',
  );

/** The entity's "current" description: the user's own, else the first active authority description. */
const activeDescription = (item: Element): Element | null => {
  const notes = activeNotesOfType(item, 'description');
  return (
    notes.find((note) => readEntityValueProvenance(note).origin === 'user') ?? notes[0] ?? null
  );
};

const idnoElements = (item: Element): Element[] =>
  Array.from(item.children).filter((child) => child.localName === 'idno');

const nameEntryOf = (el: Element): NameEntry => ({
  text: el.textContent?.trim() ?? '',
  lang: el.getAttribute('xml:lang'),
  type: normalizeNameType(el.getAttribute('type')),
});

const assertionValueOf = (el: Element): string =>
  el.localName === 'birth' || el.localName === 'death'
    ? (el.getAttribute('when') ?? el.textContent?.trim() ?? '')
    : (el.textContent?.trim() ?? '');

const activeDateYear = (item: Element, tag: 'birth' | 'death'): number | null => {
  const dates = Array.from(item.children).filter(
    (child) => child.localName === tag && readEntityValueProvenance(child).status === 'active',
  );
  const selected =
    dates.find((child) => readEntityValueProvenance(child).origin === 'user') ?? dates[0];
  return parseIsoYear(selected?.getAttribute('when'));
};

function summarize(item: Element): EntitySummary | null {
  const kind = kindOfElement(item);
  const id = item.getAttribute('xml:id');
  if (!kind || !id) return null;
  const nameEntries = nameElements(item, kind)
    .filter((el) => readEntityValueProvenance(el).status === 'active')
    .map(nameEntryOf)
    .filter((entry) => entry.text);
  return {
    id,
    kind,
    names: nameEntries.map((entry) => entry.text),
    nameEntries,
    romanized: nameEntries.find((entry) => isLatnLang(entry.lang))?.text ?? null,
    description: activeDescription(item)?.textContent?.trim() || null,
    authorities: idnoElements(item)
      .filter((el) => el.getAttribute('type') !== CENTRAL_IDNO_TYPE)
      .filter((el) => readEntityValueProvenance(el).status === 'active')
      .map((el) => ({
        type: el.getAttribute('type') ?? '',
        value: el.textContent?.trim() ?? '',
      }))
      .filter((ref) => ref.type && ref.value),
    familyName: familyNameNote(item)?.textContent?.trim() || null,
    givenName: givenNameNote(item)?.textContent?.trim() || null,
    startYear: activeDateYear(item, 'birth'),
    endYear: activeDateYear(item, 'death'),
    nationalities: Array.from(
      new Set(
        Array.from(item.children)
          .filter((child) => child.localName === 'nationality')
          .filter((child) => readEntityValueProvenance(child).status === 'active')
          .map((child) =>
            canonicalNationalityLabel(
              readEntityValueProvenance(child).source,
              child.getAttribute('ref'),
              child.textContent?.trim() ?? '',
            ),
          )
          .filter(Boolean),
      ),
    ),
    placesOfOrigin: Array.from(
      new Set(
        Array.from(item.children)
          .filter((child) => child.localName === 'placeName')
          .filter((child) => readEntityValueProvenance(child).status === 'active')
          .map((child) => child.textContent?.trim() ?? '')
          .filter(Boolean),
      ),
    ),
    origins: Array.from(
      new Set(
        Array.from(item.children)
          .filter(
            (child) => child.localName !== 'note' || child.getAttribute('type') !== 'ljb-changed',
          )
          .filter((child) => readEntityValueProvenance(child).status === 'active')
          .map((child) => readEntityValueProvenance(child).origin),
      ),
    ),
    rejectedCount: Array.from(item.children).filter(
      (child) => readEntityValueProvenance(child).status === 'rejected',
    ).length,
    rejectedAssertions: Array.from(item.children)
      .filter((child) => readEntityValueProvenance(child).status === 'rejected')
      .map((child) => ({
        element: child.localName,
        value: assertionValueOf(child),
        source: readEntityValueProvenance(child).source,
      }))
      .filter((assertion) => assertion.value),
    rejectedConcordances: listConcordanceRejectionsForEntity(item.ownerDocument, id),
    assertions: Array.from(item.children)
      .filter((child) => child.localName !== 'note' || child.getAttribute('type') !== 'ljb-changed')
      .map((child) => ({
        key: entityValueKey(child),
        element: child.localName,
        value: assertionValueOf(child),
        ...readEntityValueProvenance(child),
        precision:
          child.localName === 'birth' || child.localName === 'death'
            ? child.getAttribute('precision')
            : undefined,
        noteType: child.localName === 'note' ? child.getAttribute('type') : undefined,
        ref: child.getAttribute('ref'),
      }))
      .filter((assertion) => assertion.value || assertion.element === 'idno'),
  };
}

export interface EntityAssertionSummary {
  key: string;
  element: string;
  value: string;
  origin: EntityValueOrigin;
  source: string | null;
  status: EntityValueStatus;
  precision?: string | null;
  /** `<note>`'s `@type` (e.g. "description", "authority-cache"); undefined for non-note elements. */
  noteType?: string | null;
  /** `@ref` (e.g. a nationality's source-specific dynasty id), when the element carries one. */
  ref: string | null;
}

/** List field-level assertions, including rejected values for the review UI. */
export function listEntityAssertions(doc: Document, id: string): EntityAssertionSummary[] {
  const item = requireEntity(doc, id);
  return Array.from(item.children)
    .filter((child) => child.localName !== 'note' || child.getAttribute('type') !== 'ljb-changed')
    .map((child) => {
      const provenance = readEntityValueProvenance(child);
      return {
        key: entityValueKey(child),
        element: child.localName,
        value: assertionValueOf(child),
        ...provenance,
        precision:
          child.localName === 'birth' || child.localName === 'death'
            ? child.getAttribute('precision')
            : undefined,
        noteType: child.localName === 'note' ? child.getAttribute('type') : undefined,
        ref: child.getAttribute('ref'),
      };
    })
    .filter((assertion) => assertion.value || assertion.element === 'idno');
}

export interface FieldAssertionGroups {
  /** Distinct authority sources whose active value exactly matches a value in `acceptedValues`. */
  agreeingSources: string[];
  /** Active authority assertions whose value is NOT in `acceptedValues` — still awaiting accept/reject. */
  pending: EntityAssertionSummary[];
  /** Rejected assertions for this field. */
  rejected: EntityAssertionSummary[];
}

/**
 * Group one field's assertions (already filtered to a single element tag) into
 * agreeing/pending/rejected, generalizing the birth/death dedup pattern to any
 * repeatable authority-sourced field (nationality, placeName, description).
 */
export function groupFieldAssertions(
  assertions: EntityAssertionSummary[],
  /** Already-canonical accepted values (e.g. from `EntitySummary`, which normalizes via `keyOf`). */
  acceptedValues: Set<string>,
  showRejected: boolean,
  /** Canonical grouping key for an assertion (e.g. dynasty-id crosswalk); keyed on its raw value by default. */
  keyOf: (assertion: EntityAssertionSummary) => string = (assertion) => assertion.value,
): FieldAssertionGroups {
  const active = assertions.filter(
    (assertion) =>
      assertion.origin === 'authority' && (showRejected || assertion.status === 'active'),
  );
  const agreeingSources = Array.from(
    new Set(
      active
        .filter(
          (assertion) => assertion.status === 'active' && acceptedValues.has(keyOf(assertion)),
        )
        .map((assertion) => assertion.source?.split(':')[0])
        .filter((source): source is string => Boolean(source)),
    ),
  );
  const pending = active.filter(
    (assertion) => assertion.status === 'active' && !acceptedValues.has(keyOf(assertion)),
  );
  const rejected = active.filter((assertion) => assertion.status === 'rejected');
  return { agreeingSources, pending, rejected };
}

/** Accept an imported value as a user assertion while retaining its source. */
export function validateEntityAssertion(doc: Document, id: string, key: string): boolean {
  const item = requireEntity(doc, id);
  const target = Array.from(item.children).find((child) => entityValueKey(child) === key);
  if (!target) return false;
  const current = readEntityValueProvenance(target);
  if (current.origin === 'user' && current.status === 'active') return false;
  writeEntityValueProvenance(target, { origin: 'user', source: current.source, status: 'active' });
  touchEntity(item);
  return true;
}

/** Reject an imported value without deleting its durable source/value tombstone. */
export function rejectEntityAssertion(doc: Document, id: string, key: string): boolean {
  const item = requireEntity(doc, id);
  const target = Array.from(item.children).find((child) => entityValueKey(child) === key);
  if (!target) return false;
  const current = readEntityValueProvenance(target);
  if (current.origin === 'user' || current.status === 'rejected') return false;
  writeEntityValueProvenance(target, {
    origin: current.origin,
    source: current.source,
    status: 'rejected',
  });
  touchEntity(item);
  return true;
}

/** Restore a rejected imported assertion so the next refresh can use it. */
export function restoreEntityAssertion(doc: Document, id: string, key: string): boolean {
  const item = requireEntity(doc, id);
  const target = Array.from(item.children).find((child) => entityValueKey(child) === key);
  if (!target) return false;
  const current = readEntityValueProvenance(target);
  if (current.status !== 'rejected' || current.origin === 'user') return false;
  writeEntityValueProvenance(target, {
    origin: current.origin,
    source: current.source,
    status: 'active',
  });
  touchEntity(item);
  return true;
}

/**
 * Detach one authority. Active authority values are removed; rejected values
 * remain as tombstones so a later refresh cannot silently re-add them.
 */
export function decoupleAuthority(doc: Document, id: string, authority: AuthorityId): number {
  const item = requireEntity(doc, id);
  const normalizedValue = normalizeAuthorityValue(authority.type, authority.value);
  let removed = 0;
  for (const child of Array.from(item.children)) {
    const provenance = readEntityValueProvenance(child);
    const matchesId =
      child.localName === 'idno' &&
      child.getAttribute('type') === authority.type &&
      normalizeAuthorityValue(authority.type, child.textContent?.trim() ?? '') === normalizedValue;
    const matchesSource = provenance.source?.startsWith(`${authority.type}:`)
      ? normalizeAuthorityValue(
          authority.type,
          provenance.source.slice(authority.type.length + 1),
        ) === normalizedValue
      : false;
    if (matchesId || matchesSource) {
      if (
        provenance.origin === 'authority' &&
        (provenance.status === 'active' ||
          (provenance.status === 'rejected' &&
            (child.localName === 'birth' || child.localName === 'death')))
      ) {
        child.remove();
        removed += 1;
      }
    }
    if (
      child.localName === 'note' &&
      child.getAttribute('type') === 'authority-cache' &&
      (child.getAttribute('source') === authority.type ||
        child.getAttribute('source') === `${authority.type}:${authority.value}`)
    ) {
      child.remove();
      removed += 1;
    }
  }
  if (removed) touchEntity(item);
  return removed;
}

/** Every entity in the database, in document order. */
export function listEntities(doc: Document): EntitySummary[] {
  const out: EntitySummary[] = [];
  for (const kind of Object.keys(ENTITY_KINDS) as EntityKind[]) {
    for (const item of entityElements(doc, kind)) {
      const summary = summarize(item);
      if (summary) out.push(summary);
    }
  }
  return out;
}

/**
 * Names of this entity that may seed corpus auto-tagging: untyped legacy
 * names and every type not on the exclusion list. Excluded types (courtesy
 * names by default — a 字 like 平子 is a common word and would produce
 * nonsense tags) remain searchable and usable for manual disambiguation; any
 * feature that tags the corpus from entities.xml must draw from this list.
 */
export function taggableEntityNames(
  entity: EntitySummary,
  excludedOrPolicy?: NameTypeId[] | NameTypeTaggingPolicy,
): string[] {
  if (isNameTypeTaggingPolicy(excludedOrPolicy)) {
    return entity.nameEntries
      .filter((entry) => isPhase1SeedName(entry.type, entry.text, excludedOrPolicy))
      .map((entry) => entry.text);
  }
  return entity.nameEntries
    .filter((entry) => isTaggableNameType(entry.type, excludedOrPolicy))
    .map((entry) => entry.text);
}

function requireEntity(doc: Document, id: string): Element {
  const item = findEntity(doc, id);
  if (!item) throw new Error(`Entity not found: ${id}`);
  return item;
}

/** Add a user-asserted repeatable value (nationality/placeName), deduped against existing active values. */
function addUserValue(
  doc: Document,
  id: string,
  tag: 'nationality' | 'placeName',
  label: string,
  reference?: { ref?: string; source?: string },
): boolean {
  const item = requireEntity(doc, id);
  const trimmed = label.trim();
  if (!trimmed) return false;
  const exists = Array.from(item.children).some(
    (child) =>
      child.localName === tag &&
      readEntityValueProvenance(child).status === 'active' &&
      child.textContent?.trim() === trimmed,
  );
  if (exists) return false;
  const el = doc.createElementNS(TEI_NS, tag);
  el.textContent = trimmed;
  if (reference?.ref) el.setAttribute('ref', reference.ref);
  writeEntityValueProvenance(el, {
    origin: 'user',
    source: reference?.source ?? null,
    status: 'active',
  });
  item.appendChild(el);
  touchEntity(item);
  return true;
}

/** Add a user-typed nationality/dynasty value. */
export function addUserNationality(
  doc: Document,
  id: string,
  label: string,
  reference?: { ref?: string; source?: string },
): boolean {
  return addUserValue(doc, id, 'nationality', label, reference);
}

/** Add a user-typed place-of-origin value. */
export function addUserOrigin(
  doc: Document,
  id: string,
  label: string,
  reference?: { ref?: string; source?: string },
): boolean {
  return addUserValue(doc, id, 'placeName', label, reference);
}

/**
 * Remove one currently-active value by its assertion key: a user-origin value
 * is deleted outright, an authority-origin one is rejected (tombstoned) so a
 * later refresh doesn't silently re-add it.
 */
export function removeEntityValue(doc: Document, id: string, key: string): boolean {
  const item = requireEntity(doc, id);
  const target = Array.from(item.children).find((child) => entityValueKey(child) === key);
  if (!target) return false;
  const provenance = readEntityValueProvenance(target);
  if (provenance.status !== 'active') return false;
  if (provenance.origin === 'user') {
    target.remove();
  } else {
    writeEntityValueProvenance(target, {
      origin: provenance.origin,
      source: provenance.source,
      status: 'rejected',
    });
  }
  touchEntity(item);
  return true;
}

/**
 * Set (or clear, with empty text) the user's own one-line description,
 * leaving any authority-sourced descriptions untouched (there may be
 * several, one per source — see `acceptEntityDescriptionAssertion`).
 */
export function setEntityDescription(doc: Document, id: string, text: string): void {
  const item = requireEntity(doc, id);
  const existing = Array.from(item.children).find(
    (child) =>
      child.localName === 'note' &&
      child.getAttribute('type') === 'description' &&
      readEntityValueProvenance(child).origin === 'user',
  );
  const trimmed = text.trim();
  if (!trimmed) {
    if (existing) {
      existing.remove();
      touchEntity(item);
    }
    return;
  }
  if (existing) {
    if ((existing.textContent?.trim() ?? '') !== trimmed) {
      existing.textContent = trimmed;
      touchEntity(item);
    }
    return;
  }
  const note = doc.createElementNS(TEI_NS, 'note');
  note.setAttribute('type', 'description');
  note.textContent = trimmed;
  writeEntityValueProvenance(note, { origin: 'user', source: null, status: 'active' });
  item.appendChild(note);
  touchEntity(item);
}

/** Set (or clear, with empty text) a person's family name (surname), stored separately from the display name. */
export function setFamilyName(doc: Document, id: string, text: string): void {
  setNoteOfType(doc, id, 'familyName', text);
}

/** Set (or clear, with empty text) a person's given name, stored separately from the display name. */
export function setGivenName(doc: Document, id: string, text: string): void {
  setNoteOfType(doc, id, 'givenName', text);
}

export type DatePart = 'birth' | 'death';
export type DatePrecision =
  | ''
  | 'b.'
  | 'b. ca.'
  | 'active'
  | 'active ca.'
  | 'fl.'
  | 'd.'
  | 'd. ca.'
  | 'active to'
  | 'active to ca.';

/** Set or clear a user-controlled birth/death value while preserving authority assertions. */
export function setUserEntityDate(
  doc: Document,
  id: string,
  part: DatePart,
  year: number | null,
  precision: DatePrecision = '',
): void {
  const item = requireEntity(doc, id);
  const existing = Array.from(item.children).find(
    (child) => child.localName === part && readEntityValueProvenance(child).origin === 'user',
  );
  if (year == null) {
    if (existing) existing.remove();
  } else {
    const element = existing ?? doc.createElementNS(TEI_NS, part);
    element.setAttribute('when', isoYearString(year));
    if (precision) element.setAttribute('precision', precision);
    else element.removeAttribute('precision');
    writeEntityValueProvenance(element, { origin: 'user', source: null, status: 'active' });
    if (!existing) item.appendChild(element);
  }
  touchEntity(item);
}

/** Promote an authority date assertion to the user's selected date. */
export function acceptEntityDateAssertion(doc: Document, id: string, key: string): boolean {
  const item = requireEntity(doc, id);
  const target = Array.from(item.children).find((child) => entityValueKey(child) === key);
  if (!target || (target.localName !== 'birth' && target.localName !== 'death')) return false;
  const part = target.localName as DatePart;
  const userDate = Array.from(item.children).find(
    (child) => child.localName === part && readEntityValueProvenance(child).origin === 'user',
  );
  if (userDate && userDate !== target) userDate.remove();
  writeEntityValueProvenance(target, { origin: 'user', source: null, status: 'active' });
  touchEntity(item);
  return true;
}

/** Promote an authority description assertion to the user's own description. */
export function acceptEntityDescriptionAssertion(doc: Document, id: string, key: string): boolean {
  const item = requireEntity(doc, id);
  const target = Array.from(item.children).find((child) => entityValueKey(child) === key);
  if (!target || target.localName !== 'note' || target.getAttribute('type') !== 'description') {
    return false;
  }
  const userNote = Array.from(item.children).find(
    (child) =>
      child.localName === 'note' &&
      child.getAttribute('type') === 'description' &&
      readEntityValueProvenance(child).origin === 'user',
  );
  if (userNote && userNote !== target) userNote.remove();
  writeEntityValueProvenance(target, { origin: 'user', source: null, status: 'active' });
  touchEntity(item);
  return true;
}

/** Current family name, or null when unset. */
export function getFamilyName(doc: Document, id: string): string | null {
  return familyNameNote(requireEntity(doc, id))?.textContent?.trim() || null;
}

/** Current given name, or null when unset. */
export function getGivenName(doc: Document, id: string): string | null {
  return givenNameNote(requireEntity(doc, id))?.textContent?.trim() || null;
}

function setNoteOfType(doc: Document, id: string, type: string, text: string): void {
  const item = requireEntity(doc, id);
  const existing = noteOfType(item, type);
  const trimmed = text.trim();
  if (!trimmed) {
    if (existing) {
      existing.remove();
      touchEntity(item);
    }
    return;
  }
  if (existing) {
    if ((existing.textContent?.trim() ?? '') !== trimmed) {
      existing.textContent = trimmed;
      touchEntity(item);
    }
    return;
  }
  const note = doc.createElementNS(TEI_NS, 'note');
  note.setAttribute('type', type);
  note.textContent = trimmed;
  item.appendChild(note);
  touchEntity(item);
}

export interface NameAttributes {
  lang?: string;
  type?: NameTypeId;
  origin?: EntityValueOrigin;
  source?: string | null;
}

/**
 * Add an alternative name (extra name element) unless it already exists.
 * When the text is already present on an attribute-less (legacy) element and
 * attributes are provided, the existing element is upgraded in place.
 */
export function addEntityName(
  doc: Document,
  id: string,
  name: string,
  attributes?: NameAttributes,
): boolean {
  const item = requireEntity(doc, id);
  const kind = kindOfElement(item);
  if (!kind) throw new Error(`Unknown entity kind for: ${id}`);
  const trimmed = name.trim();
  if (!trimmed) return false;
  const names = nameElements(item, kind);
  const existing = names.find((el) => el.textContent?.trim() === trimmed);
  if (existing) {
    let upgraded = false;
    if (attributes?.lang && !existing.getAttribute('xml:lang')) {
      existing.setAttributeNS(XML_NS, 'xml:lang', attributes.lang);
      upgraded = true;
    }
    if (attributes?.type && !existing.getAttribute('type')) {
      existing.setAttribute('type', attributes.type);
      upgraded = true;
    }
    if (attributes?.origin && !existing.hasAttribute('origin')) {
      writeEntityValueProvenance(existing, {
        origin: attributes.origin,
        source: attributes.source,
      });
      upgraded = true;
    }
    if (upgraded) touchEntity(item);
    return false;
  }
  const el = doc.createElementNS(TEI_NS, ENTITY_KINDS[kind].name);
  el.textContent = trimmed;
  if (attributes?.lang) el.setAttributeNS(XML_NS, 'xml:lang', attributes.lang);
  if (attributes?.type) el.setAttribute('type', attributes.type);
  if (attributes?.origin) {
    writeEntityValueProvenance(el, {
      origin: attributes.origin,
      source: attributes.source,
    });
  }
  const last = names[names.length - 1];
  if (last?.nextSibling) item.insertBefore(el, last.nextSibling);
  else item.appendChild(el);
  touchEntity(item);
  return true;
}

/**
 * Set, replace, or (with empty text) remove the entity's Latin-script name.
 * The romanized element always sits right after the first name element so the
 * display-name invariant (first element wins) is preserved.
 */
export function setRomanizedName(
  doc: Document,
  id: string,
  text: string,
  primaryLang?: string | null,
): void {
  const item = requireEntity(doc, id);
  const kind = kindOfElement(item);
  if (!kind) throw new Error(`Unknown entity kind for: ${id}`);
  const names = nameElements(item, kind);
  const existing = names.find((el) => isLatnLang(el.getAttribute('xml:lang')));
  const trimmed = text.trim();
  if (!trimmed) {
    if (existing) {
      existing.remove();
      touchEntity(item);
    }
    return;
  }
  if (existing) {
    if ((existing.textContent?.trim() ?? '') !== trimmed) {
      existing.textContent = trimmed;
      touchEntity(item);
    }
    return;
  }
  const el = doc.createElementNS(TEI_NS, ENTITY_KINDS[kind].name);
  el.textContent = trimmed;
  el.setAttributeNS(XML_NS, 'xml:lang', latnLangFor(primaryLang));
  const first = names[0];
  if (first?.nextSibling) item.insertBefore(el, first.nextSibling);
  else if (first) item.appendChild(el);
  else item.insertBefore(el, item.firstChild);
  touchEntity(item);
}

/**
 * Set (or clear, with null) the name type of the name element whose text
 * matches. Creates the name when the entity doesn't carry it yet.
 */
export function setNameType(
  doc: Document,
  id: string,
  nameText: string,
  type: NameTypeId | null,
  lang?: string,
): void {
  const item = requireEntity(doc, id);
  const kind = kindOfElement(item);
  if (!kind) throw new Error(`Unknown entity kind for: ${id}`);
  const trimmed = nameText.trim();
  if (!trimmed) return;

  if (type === 'family') {
    setNoteOfType(doc, id, 'familyName', trimmed);
  } else if (type === 'given') {
    setNoteOfType(doc, id, 'givenName', trimmed);
  } else if (type === null) {
    if (familyNameNote(item)?.textContent?.trim() === trimmed) {
      setNoteOfType(doc, id, 'familyName', '');
    }
    if (givenNameNote(item)?.textContent?.trim() === trimmed) {
      setNoteOfType(doc, id, 'givenName', '');
    }
  } else {
    if (familyNameNote(item)?.textContent?.trim() === trimmed) {
      setNoteOfType(doc, id, 'familyName', '');
    }
    if (givenNameNote(item)?.textContent?.trim() === trimmed) {
      setNoteOfType(doc, id, 'givenName', '');
    }
  }

  const target = nameElements(item, kind).find((el) => el.textContent?.trim() === trimmed);
  if (target) {
    if (type) target.setAttribute('type', type);
    else target.removeAttribute('type');
    touchEntity(item);
    return;
  }
  if (type) addEntityName(doc, id, trimmed, { type, lang });
}

/**
 * Rename the canonical/display name for an entity.
 * This updates the first name element in place and removes duplicate entries
 * that would otherwise repeat the same visible label.
 */
export function renameEntityName(doc: Document, id: string, name: string): boolean {
  const item = requireEntity(doc, id);
  const kind = kindOfElement(item);
  if (!kind) throw new Error(`Unknown entity kind for: ${id}`);
  const trimmed = name.trim();
  if (!trimmed) return false;

  const names = nameElements(item, kind);
  const current = names[0];
  if (!current) return false;

  const currentText = current.textContent?.trim() ?? '';
  if (currentText === trimmed) return false;

  current.textContent = trimmed;
  for (const duplicate of names.slice(1)) {
    if ((duplicate.textContent?.trim() ?? '') === trimmed) duplicate.remove();
  }
  touchEntity(item);
  return true;
}

/** Remove an alternative name. Refuses to remove the last remaining name. */
export function removeEntityName(doc: Document, id: string, name: string): boolean {
  const item = requireEntity(doc, id);
  const kind = kindOfElement(item);
  if (!kind) throw new Error(`Unknown entity kind for: ${id}`);
  const names = nameElements(item, kind);
  if (names.length <= 1) return false;
  const target = names.find((el) => el.textContent?.trim() === name.trim());
  if (!target) return false;
  target.remove();
  touchEntity(item);
  return true;
}

/** Attach an authority idno unless the same type+value is already present. */
export function attachAuthority(doc: Document, id: string, ref: AuthorityId): boolean {
  const item = requireEntity(doc, id);
  const normalizedValue = normalizeAuthorityValue(ref.type, ref.value);
  const exists = idnoElements(item).some(
    (el) =>
      el.getAttribute('type') === ref.type &&
      normalizeAuthorityValue(ref.type, el.textContent?.trim() ?? '') === normalizedValue,
  );
  if (exists) return false;
  const idno = doc.createElementNS(TEI_NS, 'idno');
  idno.setAttribute('type', ref.type);
  idno.textContent = ref.value.trim();
  item.appendChild(idno);
  touchEntity(item);
  return true;
}

/** Detach an authority idno (exact type+value match). */
export function detachAuthority(doc: Document, id: string, ref: AuthorityId): boolean {
  const item = requireEntity(doc, id);
  const target = idnoElements(item).find(
    (el) => el.getAttribute('type') === ref.type && el.textContent?.trim() === ref.value.trim(),
  );
  if (!target) return false;
  target.remove();
  touchEntity(item);
  return true;
}

export interface CentralMergeConflict {
  /** Stable user id whose mapping disagreed (the idno's `subtype`). */
  userStableId: string;
  /** The central id kept on the survivor. */
  keptCentralId: string;
  /** The central id the dropped entity named for the same user — a possible CEDB duplicate. */
  droppedCentralId: string;
}

export interface MergeResult {
  keepId: string;
  /** Old id → surviving id, for rewriting `@key` across documents. */
  remap: Record<string, string>;
  /**
   * Per-user `ljb-central` mappings that disagreed between keeper and a
   * dropped entity (both non-empty, naming different central ids). Neither
   * side is overwritten; the caller surfaces these as a "these two central
   * entities might be duplicates too" suggestion instead of silently picking
   * one.
   */
  centralConflicts: CentralMergeConflict[];
}

/**
 * Merge `dropIds` into `keepId`: union names, authority idnos, and notes
 * (keeper's description wins; a dropped description is kept only when the
 * keeper has none). Dropped elements are removed from the document.
 *
 * The per-user `ljb-central` concordance row is handled separately from
 * ordinary authority idnos (never blindly copied — it would silently lose its
 * `subtype`/user id via the generic idno-copy path): a mapping the keeper
 * lacks is transferred from the dropped entity; a mapping only the keeper has
 * stays; a mapping present on both sides that names different central ids is
 * left on the keeper as-is and reported as a `centralConflicts` entry.
 */
export function mergeEntities(doc: Document, keepId: string, dropIds: string[]): MergeResult {
  const keeper = requireEntity(doc, keepId);
  const kind = kindOfElement(keeper);
  if (!kind) throw new Error(`Unknown entity kind for: ${keepId}`);

  const remap: Record<string, string> = {};
  const centralConflicts: CentralMergeConflict[] = [];
  for (const dropId of dropIds) {
    if (dropId === keepId) continue;
    const dropped = requireEntity(doc, dropId);
    const droppedKind = kindOfElement(dropped);
    if (droppedKind !== kind) {
      throw new Error(
        `Cannot merge ${dropId} (${droppedKind ?? 'unknown'}) into ${keepId} (${kind}): different kinds.`,
      );
    }

    for (const name of nameElements(dropped, kind)) {
      const text = name.textContent?.trim();
      if (!text) continue;
      const lang = name.getAttribute('xml:lang') ?? undefined;
      const rawType = normalizeNameType(name.getAttribute('type')) ?? undefined;
      // The keeper already has its own primary name; a dropped primary joins as a variant.
      const type = rawType === 'primary' ? 'variant' : rawType;
      addEntityName(doc, keepId, text, { lang, type });
    }
    for (const idno of idnoElements(dropped)) {
      const type = idno.getAttribute('type');
      const value = idno.textContent?.trim();
      // The ljb-central row is per-user metadata, not a shared authority id —
      // handled below, where the subtype (user id) is preserved correctly.
      if (type && value && type !== CENTRAL_IDNO_TYPE)
        attachAuthority(doc, keepId, { type, value });
    }
    for (const mapping of listCentralMappings(dropped)) {
      const keptCentralId = getCentralId(keeper, mapping.userStableId);
      if (!keptCentralId) {
        setCentralMapping(keeper, mapping.userStableId, mapping.centralId);
      } else if (keptCentralId !== mapping.centralId) {
        centralConflicts.push({
          userStableId: mapping.userStableId,
          keptCentralId,
          droppedCentralId: mapping.centralId,
        });
      }
    }
    const droppedDescription = activeDescription(dropped)?.textContent?.trim();
    if (droppedDescription && !activeDescription(keeper)) {
      setEntityDescription(doc, keepId, droppedDescription);
    }
    const droppedFamilyName = familyNameNote(dropped)?.textContent?.trim();
    if (droppedFamilyName && !familyNameNote(keeper)) {
      setFamilyName(doc, keepId, droppedFamilyName);
    }
    const droppedGivenName = givenNameNote(dropped)?.textContent?.trim();
    if (droppedGivenName && !givenNameNote(keeper)) {
      setGivenName(doc, keepId, droppedGivenName);
    }
    // Carry over authority-cache notes for sources the keeper lacks.
    for (const note of Array.from(dropped.children).filter(
      (child) => child.localName === 'note' && child.getAttribute('type') === 'authority-cache',
    )) {
      const source = note.getAttribute('source');
      const alreadyCached = Array.from(keeper.children).some(
        (child) =>
          child.localName === 'note' &&
          child.getAttribute('type') === 'authority-cache' &&
          child.getAttribute('source') === source,
      );
      if (!alreadyCached) keeper.appendChild(note.cloneNode(true));
    }

    dropped.remove();
    remap[dropId] = keepId;
  }
  if (Object.keys(remap).length > 0) touchEntity(keeper);
  return { keepId, remap, centralConflicts };
}

/**
 * Delete an entity from the database. Mentions keep their tags; the caller
 * strips the now-dangling `@key` across documents via the remap engine.
 */
export function deleteEntity(doc: Document, id: string): void {
  requireEntity(doc, id).remove();
}

/**
 * Normalize an authority value for duplicate comparison: Wikidata URLs in any
 * form collapse to the Q-id; VIAF URLs collapse to the numeric id; everything
 * else compares trimmed.
 */
export function normalizeAuthorityValue(type: string, value: string): string {
  const trimmed = value.trim();
  if (/^wikidata$/i.test(type)) {
    const match = trimmed.match(/(Q\d+)\s*$/i);
    if (match) return match[1]!.toUpperCase();
  }
  if (/^viaf$/i.test(type)) {
    const match = trimmed.match(/(\d+)\s*\/?\s*$/);
    if (match) return match[1]!;
  }
  return trimmed;
}

export interface DuplicateGroup {
  /** Authority type, e.g. "Wikidata". */
  type: string;
  /** Normalized shared value, e.g. "Q468747". */
  value: string;
  entityIds: string[];
}

/** Ids covered by a `duplicate-ok` note, per note (each note is one group). */
function intentionalGroups(doc: Document): string[][] {
  const groups: string[][] = [];
  for (const note of Array.from(doc.getElementsByTagName('note'))) {
    if (note.getAttribute('type') !== DUPLICATE_OK_NOTE_TYPE) continue;
    const target = note.getAttribute('target') ?? '';
    const ids = target
      .split(/\s+/)
      .map((ref) => ref.replace(/^#/, ''))
      .filter(Boolean);
    if (ids.length > 1) groups.push(ids);
  }
  return groups;
}

/**
 * Entities sharing the same normalized authority id. Groups fully covered by a
 * `duplicate-ok` note are suppressed; a new duplicate joining a marked group
 * re-triggers the warning.
 */
export function findAuthorityDuplicates(doc: Document): DuplicateGroup[] {
  const byRef = new Map<string, { type: string; value: string; entityIds: string[] }>();
  for (const entity of listEntities(doc)) {
    const seen = new Set<string>();
    for (const ref of entity.authorities) {
      const normalized = normalizeAuthorityValue(ref.type, ref.value);
      const key = `${ref.type.toLowerCase()}\t${normalized}`;
      if (seen.has(key)) continue; // same idno listed twice on one entity is not a duplicate
      seen.add(key);
      const group = byRef.get(key) ?? { type: ref.type, value: normalized, entityIds: [] };
      group.entityIds.push(entity.id);
      byRef.set(key, group);
    }
  }

  const intentional = intentionalGroups(doc);
  const isIntentional = (ids: string[]) =>
    intentional.some((group) => ids.every((id) => group.includes(id)));

  return Array.from(byRef.values()).filter(
    (group) => group.entityIds.length > 1 && !isIntentional(group.entityIds),
  );
}

/**
 * Record that a set of entities intentionally share an authority ref, so the
 * duplicate warning stays quiet for exactly this group. The note lives on the
 * first entity of the group.
 */
export function markDuplicateIntentional(doc: Document, ids: string[]): void {
  if (ids.length < 2) throw new Error('An intentional-duplicate group needs at least two ids.');
  const first = requireEntity(doc, ids[0]!);
  const target = ids.map((id) => `#${id}`).join(' ');
  const already = Array.from(first.children).some(
    (child) =>
      child.localName === 'note' &&
      child.getAttribute('type') === DUPLICATE_OK_NOTE_TYPE &&
      child.getAttribute('target') === target,
  );
  if (already) return;
  const note = doc.createElementNS(TEI_NS, 'note');
  note.setAttribute('type', DUPLICATE_OK_NOTE_TYPE);
  note.setAttribute('target', target);
  first.appendChild(note);
}

const concordanceRef = (source: string, id: string): string => {
  const value = /^cbdb$/i.test(source) ? id.replace(/^0+(?=\d)/, '') : id;
  return `${source.trim().toUpperCase()}:${value.trim()}`;
};

const concordanceRefs = (association: ConcordanceAssociation): [string, string] =>
  [
    concordanceRef(association.source, association.canonicalId),
    concordanceRef(association.source, association.mergedFromId),
  ].sort() as [string, string];

const allEntityElements = (doc: Document): Element[] =>
  (Object.keys(ENTITY_KINDS) as EntityKind[]).flatMap((kind) => entityElements(doc, kind));

const activeAuthorityRefs = (entity: Element): string[] =>
  idnoElements(entity)
    .filter((idno) => idno.getAttribute('type') !== CENTRAL_IDNO_TYPE)
    .filter((idno) => readEntityValueProvenance(idno).status === 'active')
    .map((idno) => concordanceRef(idno.getAttribute('type') ?? '', idno.textContent?.trim() ?? ''));

function rejectionFromNote(note: Element): ConcordanceRejection | null {
  const target = (note.getAttribute('target') ?? '').split(/\s+/).filter(Boolean);
  if (target.length !== 2) return null;
  const [leftId, rightId] = target.sort();
  return {
    source: note.getAttribute('source') ?? leftId.split(':')[0] ?? '',
    leftId,
    rightId,
    reason: note.getAttribute('reason'),
    entityId: note.parentElement?.getAttribute('xml:id') ?? null,
  };
}

export function listConcordanceRejections(doc: Document): ConcordanceRejection[] {
  return Array.from(doc.getElementsByTagName('note'))
    .filter((note) => note.getAttribute('type') === CONCORDANCE_REJECTED_NOTE_TYPE)
    .map(rejectionFromNote)
    .filter((rejection): rejection is ConcordanceRejection => rejection !== null);
}

function listConcordanceRejectionsForEntity(
  doc: Document,
  entityId: string,
): ConcordanceRejection[] {
  const entity = allEntityElements(doc).find(
    (candidate) => candidate.getAttribute('xml:id') === entityId,
  );
  if (!entity) return [];
  const refs = new Set(activeAuthorityRefs(entity));
  return listConcordanceRejections(doc).filter(
    (rejection) => refs.has(rejection.leftId) || refs.has(rejection.rightId),
  );
}

export function isConcordanceRejected(doc: Document, association: ConcordanceAssociation): boolean {
  const [left, right] = concordanceRefs(association);
  return listConcordanceRejections(doc).some(
    (rejection) => rejection.leftId === left && rejection.rightId === right,
  );
}

export function rejectConcordance(
  doc: Document,
  association: ConcordanceAssociation,
  entityId?: string,
  reason = 'user',
): void {
  if (isConcordanceRejected(doc, association)) return;
  const [left, right] = concordanceRefs(association);
  const owner = entityId
    ? findEntity(doc, entityId)
    : allEntityElements(doc).find((entity) =>
        activeAuthorityRefs(entity).some((ref) => ref === left || ref === right),
      );
  if (!owner) return;
  const note = doc.createElementNS(TEI_NS, 'note');
  note.setAttribute('type', CONCORDANCE_REJECTED_NOTE_TYPE);
  note.setAttribute('source', association.source);
  note.setAttribute('target', `${left} ${right}`);
  note.setAttribute('reason', reason);
  if (association.notes) note.textContent = association.notes;
  owner.appendChild(note);
}

export function applyConcordanceAssociations(
  doc: Document,
  associations: ConcordanceAssociation[],
): ConcordanceImportResult {
  const result: ConcordanceImportResult = {
    applied: 0,
    alreadyPresent: 0,
    rejected: 0,
    unresolved: 0,
    conflicts: [],
  };
  for (const association of associations) {
    if (isConcordanceRejected(doc, association)) {
      result.rejected++;
      continue;
    }
    const [left, right] = concordanceRefs(association);
    const owners = allEntityElements(doc).filter((entity) => {
      const refs = activeAuthorityRefs(entity);
      return refs.includes(left) || refs.includes(right);
    });
    if (owners.length === 0) {
      result.unresolved++;
      continue;
    }
    if (owners.length > 1) {
      result.conflicts.push({
        association,
        entityIds: owners.map((entity) => entity.getAttribute('xml:id')!).filter(Boolean),
      });
      continue;
    }
    const owner = owners[0]!;
    const refs = new Set(activeAuthorityRefs(owner));
    const missing = [
      [association.source, association.canonicalId],
      [association.source, association.mergedFromId],
    ]
      .filter(([, id]) => !refs.has(concordanceRef(association.source, id)))
      .map(([type, value]) => ({ type, value }));
    if (!missing.length) {
      result.alreadyPresent++;
      continue;
    }
    appendAuthorityIdnos(doc, owner, missing);
    result.applied++;
  }
  return result;
}
