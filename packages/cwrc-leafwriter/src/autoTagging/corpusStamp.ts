/**
 * Stamp each corpus TEI file with the fingerprint of the project database
 * (PEDB) its `@key`s belong to:
 *
 *   <idno type="ljb-project-database">{pedbFingerprint}</idno>
 *
 * placed in the file's `<publicationStmt>`. This lets the orphan sweep tell two
 * very different situations apart before it ever strips a key: a file *copied
 * from another project* (stamp names a different PEDB) versus a genuine orphan
 * because the PEDB was rolled back (stamp matches, key simply missing). Only the
 * latter is safe to auto-purge; the former is a misfiled file to leave alone.
 *
 * Operations are string-based to preserve the corpus file's exact formatting,
 * matching `rewriteMentionKeys`; no DOM round-trip.
 */

/** `<idno type>` value that stamps a corpus file with its owning PEDB fingerprint. */
export const PROJECT_DB_IDNO_TYPE = 'ljb-project-database';

const STAMP_RE = new RegExp(
  `<idno\\b[^>]*\\btype=(["'])${PROJECT_DB_IDNO_TYPE}\\1[^>]*>([\\s\\S]*?)<\\/idno>`,
);

/** Read a corpus file's PEDB stamp, or null when unstamped. */
export function readProjectStamp(xml: string): string | null {
  const match = STAMP_RE.exec(xml);
  return match ? match[2]!.trim() || null : null;
}

export interface StampResult {
  xml: string;
  /** True when the stamp was inserted or changed; false when already correct. */
  changed: boolean;
  /** True when no `<publicationStmt>` was found, so nothing could be stamped. */
  skipped: boolean;
}

/**
 * Ensure the corpus file carries `pedbFingerprint` as its project-database
 * stamp. Updates an existing stamp in place, otherwise inserts one just before
 * `</publicationStmt>`. Leaves the file untouched (skipped) when it has no
 * `<publicationStmt>`.
 */
export function stampProjectDatabase(xml: string, pedbFingerprint: string): StampResult {
  const existing = STAMP_RE.exec(xml);
  if (existing) {
    if (existing[2]!.trim() === pedbFingerprint) {
      return { xml, changed: false, skipped: false };
    }
    const replaced =
      xml.slice(0, existing.index) +
      `<idno type="${PROJECT_DB_IDNO_TYPE}">${pedbFingerprint}</idno>` +
      xml.slice(existing.index + existing[0].length);
    return { xml: replaced, changed: true, skipped: false };
  }

  const closeIdx = xml.indexOf('</publicationStmt>');
  if (closeIdx === -1) {
    return { xml, changed: false, skipped: true };
  }
  const insertion = `<idno type="${PROJECT_DB_IDNO_TYPE}">${pedbFingerprint}</idno>`;
  const stamped = xml.slice(0, closeIdx) + insertion + xml.slice(closeIdx);
  return { xml: stamped, changed: true, skipped: false };
}
