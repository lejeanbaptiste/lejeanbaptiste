/**
 * Read/modify operations over the entity database document for the database
 * panel (Phase 6): listing, descriptions, alternative names, authority
 * attach/detach, merge, delete, and duplicate-authority detection. All
 * functions mutate the passed Document; the caller persists via EntityStore.
 */

import { isLatnLang, latnLangFor } from '../utilities/languageCodes';
import { ENTITY_KINDS, findEntity, type AuthorityId, type EntityKind } from './entities';
import { isTaggableNameType, normalizeNameType, type NameTypeId } from './nameTypes';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

/** Entity item element name → kind. */
const ITEM_TO_KIND: Record<string, EntityKind> = Object.fromEntries(
  (Object.entries(ENTITY_KINDS) as [EntityKind, (typeof ENTITY_KINDS)[EntityKind]][]).map(
    ([kind, config]) => [config.item, kind],
  ),
) as Record<string, EntityKind>;

export const DUPLICATE_OK_NOTE_TYPE = 'duplicate-ok';

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
}

const kindOfElement = (el: Element): EntityKind | null => ITEM_TO_KIND[el.localName] ?? null;

const nameElements = (item: Element, kind: EntityKind): Element[] => {
  const tag = ENTITY_KINDS[kind].name;
  return Array.from(item.children).filter((child) => child.localName === tag);
};

const descriptionNote = (item: Element): Element | null =>
  Array.from(item.children).find(
    (child) => child.localName === 'note' && child.getAttribute('type') === 'description',
  ) ?? null;

const idnoElements = (item: Element): Element[] =>
  Array.from(item.children).filter((child) => child.localName === 'idno');

const nameEntryOf = (el: Element): NameEntry => ({
  text: el.textContent?.trim() ?? '',
  lang: el.getAttribute('xml:lang'),
  type: normalizeNameType(el.getAttribute('type')),
});

function summarize(item: Element): EntitySummary | null {
  const kind = kindOfElement(item);
  const id = item.getAttribute('xml:id');
  if (!kind || !id) return null;
  const nameEntries = nameElements(item, kind)
    .map(nameEntryOf)
    .filter((entry) => entry.text);
  return {
    id,
    kind,
    names: nameEntries.map((entry) => entry.text),
    nameEntries,
    romanized: nameEntries.find((entry) => isLatnLang(entry.lang))?.text ?? null,
    description: descriptionNote(item)?.textContent?.trim() || null,
    authorities: idnoElements(item)
      .map((el) => ({
        type: el.getAttribute('type') ?? '',
        value: el.textContent?.trim() ?? '',
      }))
      .filter((ref) => ref.type && ref.value),
  };
}

/** Every entity in the database, in document order. */
export function listEntities(doc: Document): EntitySummary[] {
  const out: EntitySummary[] = [];
  for (const config of Object.values(ENTITY_KINDS)) {
    const list = doc.getElementsByTagName(config.list)[0];
    if (!list) continue;
    for (const item of Array.from(list.children)) {
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
  excluded?: NameTypeId[],
): string[] {
  return entity.nameEntries
    .filter((entry) => isTaggableNameType(entry.type, excluded))
    .map((entry) => entry.text);
}

function requireEntity(doc: Document, id: string): Element {
  const item = findEntity(doc, id);
  if (!item) throw new Error(`Entity not found: ${id}`);
  return item;
}

/** Set (or clear, with empty text) the one-line description note. */
export function setEntityDescription(doc: Document, id: string, text: string): void {
  const item = requireEntity(doc, id);
  const existing = descriptionNote(item);
  const trimmed = text.trim();
  if (!trimmed) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.textContent = trimmed;
    return;
  }
  const note = doc.createElementNS(TEI_NS, 'note');
  note.setAttribute('type', 'description');
  note.textContent = trimmed;
  item.appendChild(note);
}

export interface NameAttributes {
  lang?: string;
  type?: NameTypeId;
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
    if (attributes?.lang && !existing.getAttribute('xml:lang')) {
      existing.setAttributeNS(XML_NS, 'xml:lang', attributes.lang);
    }
    if (attributes?.type && !existing.getAttribute('type')) {
      existing.setAttribute('type', attributes.type);
    }
    return false;
  }
  const el = doc.createElementNS(TEI_NS, ENTITY_KINDS[kind].name);
  el.textContent = trimmed;
  if (attributes?.lang) el.setAttributeNS(XML_NS, 'xml:lang', attributes.lang);
  if (attributes?.type) el.setAttribute('type', attributes.type);
  const last = names[names.length - 1];
  if (last?.nextSibling) item.insertBefore(el, last.nextSibling);
  else item.appendChild(el);
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
    existing?.remove();
    return;
  }
  if (existing) {
    existing.textContent = trimmed;
    return;
  }
  const el = doc.createElementNS(TEI_NS, ENTITY_KINDS[kind].name);
  el.textContent = trimmed;
  el.setAttributeNS(XML_NS, 'xml:lang', latnLangFor(primaryLang));
  const first = names[0];
  if (first?.nextSibling) item.insertBefore(el, first.nextSibling);
  else if (first) item.appendChild(el);
  else item.insertBefore(el, item.firstChild);
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
  const target = nameElements(item, kind).find((el) => el.textContent?.trim() === trimmed);
  if (target) {
    if (type) target.setAttribute('type', type);
    else target.removeAttribute('type');
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
  return true;
}

/** Attach an authority idno unless the same type+value is already present. */
export function attachAuthority(doc: Document, id: string, ref: AuthorityId): boolean {
  const item = requireEntity(doc, id);
  const exists = idnoElements(item).some(
    (el) => el.getAttribute('type') === ref.type && el.textContent?.trim() === ref.value.trim(),
  );
  if (exists) return false;
  const idno = doc.createElementNS(TEI_NS, 'idno');
  idno.setAttribute('type', ref.type);
  idno.textContent = ref.value.trim();
  item.appendChild(idno);
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
  return true;
}

export interface MergeResult {
  keepId: string;
  /** Old id → surviving id, for rewriting `@key` across documents. */
  remap: Record<string, string>;
}

/**
 * Merge `dropIds` into `keepId`: union names, authority idnos, and notes
 * (keeper's description wins; a dropped description is kept only when the
 * keeper has none). Dropped elements are removed from the document.
 */
export function mergeEntities(doc: Document, keepId: string, dropIds: string[]): MergeResult {
  const keeper = requireEntity(doc, keepId);
  const kind = kindOfElement(keeper);
  if (!kind) throw new Error(`Unknown entity kind for: ${keepId}`);

  const remap: Record<string, string> = {};
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
      if (type && value) attachAuthority(doc, keepId, { type, value });
    }
    const droppedDescription = descriptionNote(dropped)?.textContent?.trim();
    if (droppedDescription && !descriptionNote(keeper)) {
      setEntityDescription(doc, keepId, droppedDescription);
    }
    // Carry over authority-cache notes for sources the keeper lacks.
    for (const note of Array.from(dropped.children).filter(
      (child) =>
        child.localName === 'note' && child.getAttribute('type') === 'authority-cache',
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
  return { keepId, remap };
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
