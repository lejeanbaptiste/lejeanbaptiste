/**
 * Field-level reconciliation between a project (PEDB) entity and the central
 * (CEDB) entity it maps to (via the `ljb-central` concordance). This is the
 * "compare children" step of the CEDB↔PEDB sync:
 *
 *   - **union fields** (names, external authorities) merge both ways — keep
 *     every name variant, union every authority id. Never a conflict.
 *   - **scalar fields** (description, family/given name, birth/death year): if
 *     one side is empty, fill it from the other; if both are set and *equal*,
 *     nothing to do; if both are set and *disagree*, that is a genuine conflict
 *     the user must resolve (two different birth years is not something to
 *     silently overwrite). The newer side (by `changed` timestamp) is offered
 *     as the default so a "keep all newer" bulk action is possible.
 *
 * Reconciliation only syncs entity-record *content* between the two databases.
 * It never touches corpus `@key`s — those always speak the project's id space.
 *
 * The planner is pure; `applyReconcilePlan` applies only the non-conflicting
 * parts, leaving conflicts for the caller/UI to resolve.
 */

import { CENTRAL_IDNO_TYPE } from './concordance';
import {
  findEntity,
  getEntityChanged,
  isoYearString,
  parseIsoYear,
  touchEntity,
  type AuthorityId,
} from './entities';
import { addEntityName, attachAuthority, setEntityDescription, setFamilyName, setGivenName } from './entityOps';
import { normalizeNameType } from './nameTypes';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

export type ScalarField = 'description' | 'familyName' | 'givenName' | 'startYear' | 'endYear';

export interface NameField {
  text: string;
  lang: string | null;
  type: string | null;
}

interface EntityFields {
  names: NameField[];
  authorities: AuthorityId[];
  description: string | null;
  familyName: string | null;
  givenName: string | null;
  startYear: number | null;
  endYear: number | null;
  changed: string | null;
}

const NAME_TAGS = new Set(['persName', 'placeName', 'orgName', 'title']);

const childText = (item: Element, predicate: (el: Element) => boolean): string | null => {
  const el = Array.from(item.children).find(predicate);
  return el?.textContent?.trim() || null;
};

const noteText = (item: Element, type: string): string | null =>
  childText(item, (el) => el.localName === 'note' && el.getAttribute('type') === type);

/** Read the reconcilable fields off an entity element. */
export function readFields(item: Element): EntityFields {
  const names: NameField[] = [];
  const authorities: AuthorityId[] = [];
  let startYear: number | null = null;
  let endYear: number | null = null;

  for (const child of Array.from(item.children)) {
    if (NAME_TAGS.has(child.localName)) {
      const text = child.textContent?.trim();
      if (text) {
        names.push({
          text,
          lang: child.getAttribute('xml:lang'),
          type: child.getAttribute('type'),
        });
      }
    } else if (child.localName === 'idno') {
      const type = child.getAttribute('type');
      const value = child.textContent?.trim();
      // Skip the per-user concordance row; it is not a shared authority.
      if (type && value && type !== CENTRAL_IDNO_TYPE) authorities.push({ type, value });
    } else if (child.localName === 'birth') {
      startYear = parseIsoYear(child.getAttribute('when'));
    } else if (child.localName === 'death') {
      endYear = parseIsoYear(child.getAttribute('when'));
    } else if (child.localName === 'note' && child.getAttribute('type') === 'dates') {
      const [s, e] = (child.textContent ?? '').split('/');
      startYear = parseIsoYear(s);
      endYear = parseIsoYear(e);
    }
  }

  return {
    names,
    authorities,
    description: noteText(item, 'description'),
    familyName: noteText(item, 'familyName'),
    givenName: noteText(item, 'givenName'),
    startYear,
    endYear,
    changed: getEntityChanged(item),
  };
}

export interface FieldConflict {
  field: ScalarField;
  pedbValue: string | number;
  cedbValue: string | number;
  /** Which side's `changed` timestamp is newer (the suggested default). */
  newer: 'pedb' | 'cedb' | 'equal';
}

export interface ReconcilePlan {
  addNamesToPedb: NameField[];
  addNamesToCedb: NameField[];
  addAuthoritiesToPedb: AuthorityId[];
  addAuthoritiesToCedb: AuthorityId[];
  /** Scalar fields to fill on the PEDB side (empty there, set on CEDB). */
  fillPedb: Partial<Record<ScalarField, string | number>>;
  /** Scalar fields to fill on the CEDB side (empty there, set on PEDB). */
  fillCedb: Partial<Record<ScalarField, string | number>>;
  conflicts: FieldConflict[];
  /** True when the two records already agree on every field. */
  identical: boolean;
  /** Which side is newer overall, to touch the older one to match. */
  newer: 'pedb' | 'cedb' | 'equal';
}

const nameKey = (n: NameField) => n.text;
const authorityKey = (a: AuthorityId) => `${a.type.toLowerCase()}\t${a.value.trim()}`;

const missingIn = <T>(source: T[], target: T[], key: (t: T) => string): T[] => {
  const have = new Set(target.map(key));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of source) {
    const k = key(item);
    if (have.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
};

const compareChanged = (a: string | null, b: string | null): 'pedb' | 'cedb' | 'equal' => {
  if (a && b) {
    if (a === b) return 'equal';
    return a > b ? 'pedb' : 'cedb';
  }
  if (a && !b) return 'pedb';
  if (b && !a) return 'cedb';
  return 'equal';
};

const SCALAR_FIELDS: ScalarField[] = ['description', 'familyName', 'givenName', 'startYear', 'endYear'];

const scalarOf = (fields: EntityFields, field: ScalarField): string | number | null => fields[field];

/**
 * Plan the reconciliation of a PEDB entity against its CEDB counterpart. Pure —
 * pass the two entity elements (already located via the concordance).
 */
export function planReconcile(pedbItem: Element, cedbItem: Element): ReconcilePlan {
  const pedb = readFields(pedbItem);
  const cedb = readFields(cedbItem);
  const newer = compareChanged(pedb.changed, cedb.changed);

  const plan: ReconcilePlan = {
    addNamesToPedb: missingIn(cedb.names, pedb.names, nameKey),
    addNamesToCedb: missingIn(pedb.names, cedb.names, nameKey),
    addAuthoritiesToPedb: missingIn(cedb.authorities, pedb.authorities, authorityKey),
    addAuthoritiesToCedb: missingIn(pedb.authorities, cedb.authorities, authorityKey),
    fillPedb: {},
    fillCedb: {},
    conflicts: [],
    identical: false,
    newer,
  };

  for (const field of SCALAR_FIELDS) {
    const a = scalarOf(pedb, field);
    const b = scalarOf(cedb, field);
    if (a == null && b == null) continue;
    if (a == null && b != null) {
      plan.fillPedb[field] = b;
    } else if (a != null && b == null) {
      plan.fillCedb[field] = a;
    } else if (a !== b) {
      plan.conflicts.push({ field, pedbValue: a!, cedbValue: b!, newer });
    }
  }

  plan.identical =
    plan.addNamesToPedb.length === 0 &&
    plan.addNamesToCedb.length === 0 &&
    plan.addAuthoritiesToPedb.length === 0 &&
    plan.addAuthoritiesToCedb.length === 0 &&
    Object.keys(plan.fillPedb).length === 0 &&
    Object.keys(plan.fillCedb).length === 0 &&
    plan.conflicts.length === 0;

  return plan;
}

const setScalar = (
  doc: Document,
  id: string,
  item: Element,
  field: ScalarField,
  value: string | number,
): void => {
  switch (field) {
    case 'description':
      setEntityDescription(doc, id, String(value));
      break;
    case 'familyName':
      setFamilyName(doc, id, String(value));
      break;
    case 'givenName':
      setGivenName(doc, id, String(value));
      break;
    case 'startYear':
    case 'endYear':
      setYear(item, field, Number(value));
      break;
  }
};

/** Write a birth/death year (person) or the `dates` note (non-person) in place. */
function setYear(item: Element, field: ScalarField, year: number): void {
  const isPerson = item.localName === 'person';
  if (isPerson) {
    const tag = field === 'startYear' ? 'birth' : 'death';
    let el = Array.from(item.children).find((c) => c.localName === tag);
    if (!el) {
      el = item.ownerDocument.createElementNS(TEI_NS, tag);
      item.appendChild(el);
    }
    el.setAttribute('when', isoYearString(year));
  } else {
    let note = Array.from(item.children).find(
      (c) => c.localName === 'note' && c.getAttribute('type') === 'dates',
    );
    const existing = readFields(item);
    const start = field === 'startYear' ? year : existing.startYear;
    const end = field === 'endYear' ? year : existing.endYear;
    if (!note) {
      note = item.ownerDocument.createElementNS(TEI_NS, 'note');
      note.setAttribute('type', 'dates');
      item.appendChild(note);
    }
    note.textContent = [
      start != null ? isoYearString(start) : '',
      end != null ? isoYearString(end) : '',
    ].join('/');
  }
}

/**
 * Apply the non-conflicting parts of a plan to both documents, touching each
 * side that actually changed. Conflicts are NOT applied — resolve them
 * separately (e.g. from the Bridge inbox) and re-run. Returns which sides were
 * modified.
 */
export function applyReconcilePlan(
  pedbDoc: Document,
  pedbId: string,
  cedbDoc: Document,
  cedbId: string,
  plan: ReconcilePlan,
): { pedbChanged: boolean; cedbChanged: boolean } {
  const pedbItem = findEntity(pedbDoc, pedbId);
  const cedbItem = findEntity(cedbDoc, cedbId);
  if (!pedbItem || !cedbItem) throw new Error('reconcile: entity not found in one of the documents');

  let pedbChanged = false;
  let cedbChanged = false;

  const nameAttrs = (name: NameField) => ({
    lang: name.lang ?? undefined,
    type: normalizeNameType(name.type) ?? undefined,
  });
  for (const name of plan.addNamesToPedb) {
    if (addEntityName(pedbDoc, pedbId, name.text, nameAttrs(name))) pedbChanged = true;
  }
  for (const name of plan.addNamesToCedb) {
    if (addEntityName(cedbDoc, cedbId, name.text, nameAttrs(name))) cedbChanged = true;
  }
  for (const auth of plan.addAuthoritiesToPedb) {
    if (attachAuthority(pedbDoc, pedbId, auth)) pedbChanged = true;
  }
  for (const auth of plan.addAuthoritiesToCedb) {
    if (attachAuthority(cedbDoc, cedbId, auth)) cedbChanged = true;
  }
  for (const [field, value] of Object.entries(plan.fillPedb)) {
    setScalar(pedbDoc, pedbId, pedbItem, field as ScalarField, value!);
    pedbChanged = true;
  }
  for (const [field, value] of Object.entries(plan.fillCedb)) {
    setScalar(cedbDoc, cedbId, cedbItem, field as ScalarField, value!);
    cedbChanged = true;
  }

  // Note: setEntityDescription/attachAuthority/etc. already bump `changed`; the
  // explicit touch keeps year-only edits (setYear) stamped too.
  if (pedbChanged) touchEntity(pedbItem);
  if (cedbChanged) touchEntity(cedbItem);

  return { pedbChanged, cedbChanged };
}
