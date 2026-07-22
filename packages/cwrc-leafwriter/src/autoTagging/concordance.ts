/**
 * The CEDB↔PEDB concordance ("interpretation layer"). A project (PEDB) entity
 * records, per user, the central (CEDB) id it maps to as a TEI idno:
 *
 *   <idno type="ljb-central" subtype="{userStableId}">{centralId}</idno>
 *
 * `subtype` is the stable per-user id (see `userStableId.ts`), so the same
 * scholar on two machines writes the same row, and two collaborators leave two
 * rows on the same project entity — each revealing only a central id *string*,
 * never the rest of anyone's central database. Corpus `@key`s never point at
 * central ids; this mapping is the only bridge between the two id spaces.
 *
 * These helpers are pure DOM. Writing a mapping is per-user local metadata and
 * deliberately does NOT bump the entity's `changed` timestamp (which drives
 * content reconciliation) — linking on one machine must not make the record
 * look "newer" than a genuine content edit elsewhere.
 */

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

/** `<idno type>` value that marks a per-user central-database mapping. */
export const CENTRAL_IDNO_TYPE = 'ljb-central';

export interface CentralMapping {
  /** Stable user id (the idno's `subtype`). */
  userStableId: string;
  /** The central `xml:id` this project entity maps to for that user. */
  centralId: string;
}

const centralIdnos = (item: Element): Element[] =>
  Array.from(item.children).filter(
    (child) => child.localName === 'idno' && child.getAttribute('type') === CENTRAL_IDNO_TYPE,
  );

/** Every central mapping recorded on this project entity, across all users. */
export function listCentralMappings(item: Element): CentralMapping[] {
  const out: CentralMapping[] = [];
  for (const idno of centralIdnos(item)) {
    const userStableId = idno.getAttribute('subtype')?.trim();
    const centralId = idno.textContent?.trim();
    if (userStableId && centralId) out.push({ userStableId, centralId });
  }
  return out;
}

/** The central id this project entity maps to for a given user, or null. */
export function getCentralId(item: Element, userStableId: string): string | null {
  return (
    centralIdnos(item)
      .find((idno) => idno.getAttribute('subtype')?.trim() === userStableId)
      ?.textContent?.trim() || null
  );
}

/**
 * Upsert the central mapping for one user. Returns true when something changed
 * (new row or a different central id), false when it was already exactly this.
 */
export function setCentralMapping(
  item: Element,
  userStableId: string,
  centralId: string,
): boolean {
  const existing = centralIdnos(item).find(
    (idno) => idno.getAttribute('subtype')?.trim() === userStableId,
  );
  if (existing) {
    if ((existing.textContent?.trim() ?? '') === centralId) return false;
    existing.textContent = centralId;
    return true;
  }
  const idno = item.ownerDocument.createElementNS(TEI_NS, 'idno');
  idno.setAttribute('type', CENTRAL_IDNO_TYPE);
  idno.setAttribute('subtype', userStableId);
  idno.textContent = centralId;
  item.appendChild(idno);
  return true;
}

/** Remove the central mapping for one user. Returns true when a row was removed. */
export function clearCentralMapping(item: Element, userStableId: string): boolean {
  const existing = centralIdnos(item).find(
    (idno) => idno.getAttribute('subtype')?.trim() === userStableId,
  );
  if (!existing) return false;
  existing.remove();
  return true;
}
