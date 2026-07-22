/**
 * The corpus orphan sweep: find mention `@key`s that no longer resolve to any
 * entity in the project database (PEDB), and — crucially — classify *why*
 * before anything is stripped.
 *
 * Today's mismatch recovery is blunt: on a file-level fingerprint mismatch it
 * purges *every* key in the project. That destroys good work when the real
 * problem was, say, a single file copied in from another edition. Using the
 * per-file PEDB stamp (`corpusStamp.ts`) we can tell two very different cases
 * apart:
 *
 *   - **stray file** — the file's stamp names a *different* PEDB, so its keys
 *     belong to another edition's id space. These are misfiled, not orphaned:
 *     never auto-strip them; surface the file so the user can move it back.
 *   - **genuine orphan** — the file's stamp matches this PEDB (or is absent),
 *     yet the key is missing from the database. Usually a PEDB rollback or a
 *     hand-edit. Only these are candidates for a (still severe, opt-in) purge.
 *
 * Pure over supplied file contents; the caller reads files and decides what to
 * do with the report (list occurrences, prefer Time Machine, or purge).
 */

import { readProjectStamp } from './corpusStamp';
import { collectKeys } from './rewriteMentionKeys';

export interface CorpusFile {
  path: string;
  xml: string;
}

export interface OrphanFile {
  path: string;
  /** Orphan keys found in this file (present in corpus, absent from the PEDB). */
  orphanKeys: string[];
}

export interface StrayFile extends OrphanFile {
  /** The foreign PEDB fingerprint stamped on this file. */
  stamp: string;
}

export interface OrphanSweepReport {
  /** Files whose stamp matches this PEDB (or is absent): safe to consider purging. */
  orphanFiles: OrphanFile[];
  /** Files stamped for a *different* PEDB: misfiled, never auto-purge. */
  strayFiles: StrayFile[];
  /** Total genuine-orphan keys across `orphanFiles`. */
  orphanKeyCount: number;
  /** Total keys sitting in stray files. */
  strayKeyCount: number;
}

/**
 * Classify orphan keys across the corpus. `pedbIds` is the set of entity ids
 * currently in the project database; `pedbFingerprint` is that database's
 * fingerprint (`getDatabaseId`).
 */
export function sweepOrphans(
  files: CorpusFile[],
  pedbIds: Set<string>,
  pedbFingerprint: string,
): OrphanSweepReport {
  const orphanFiles: OrphanFile[] = [];
  const strayFiles: StrayFile[] = [];
  let orphanKeyCount = 0;
  let strayKeyCount = 0;

  for (const { path, xml } of files) {
    const orphanKeys = [...collectKeys(xml)].filter((key) => !pedbIds.has(key));
    if (orphanKeys.length === 0) continue;

    const stamp = readProjectStamp(xml);
    if (stamp && stamp !== pedbFingerprint) {
      strayFiles.push({ path, stamp, orphanKeys });
      strayKeyCount += orphanKeys.length;
    } else {
      orphanFiles.push({ path, orphanKeys });
      orphanKeyCount += orphanKeys.length;
    }
  }

  return { orphanFiles, strayFiles, orphanKeyCount, strayKeyCount };
}

/** True when the sweep found anything worth showing the user. */
export function hasOrphans(report: OrphanSweepReport): boolean {
  return report.orphanFiles.length > 0 || report.strayFiles.length > 0;
}

/** The purge remap for the *genuine* orphans only (stray files are never touched). */
export function orphanPurgeRemap(report: OrphanSweepReport): Record<string, string | null> {
  const remap: Record<string, string | null> = {};
  for (const file of report.orphanFiles) {
    for (const key of file.orphanKeys) remap[key] = null;
  }
  return remap;
}
