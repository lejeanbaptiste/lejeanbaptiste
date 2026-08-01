/**
 * Norbert's MySQL person and office tables reuse the same numeric id space.
 * Entity idnos therefore namespace the bare id by kind: `person-4135`,
 * `office-4135` (same hyphen convention as local xml:ids like `person-…`).
 */

const KIND_PREFIX = /^(person|office|place)[-:](.+)$/i;

/** Format a Norbert idno value for storage (`person-12`). */
export function formatNorbertAuthorityValue(
  kind: string | undefined | null,
  bareId: string | number,
): string {
  const bare = String(bareId ?? '').trim();
  const k = String(kind ?? '')
    .trim()
    .toLowerCase();
  if (!bare) return bare;
  const existing = bare.match(KIND_PREFIX);
  if (existing) return `${existing[1]!.toLowerCase()}-${existing[2]}`;
  // Only namespace numeric person/office/place ids. Leave noble-title / wiki-nt /
  // other URN-like authority ids alone (never `person-noble-title:…`).
  if ((k === 'person' || k === 'office' || k === 'place') && /^\d+$/.test(bare)) {
    return `${k}-${bare}`;
  }
  return bare;
}

/** Strip a kind prefix when present; leave noble-title / URN values alone. */
export function bareNorbertAuthorityValue(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(KIND_PREFIX);
  return match ? match[2]! : trimmed;
}

/** Lookup keys so typed PEDB idnos still hit bare pack rows (and vice versa). */
export function norbertAuthorityLookupValues(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const bare = bareNorbertAuthorityValue(trimmed);
  return bare === trimmed ? [trimmed] : [trimmed, bare];
}
