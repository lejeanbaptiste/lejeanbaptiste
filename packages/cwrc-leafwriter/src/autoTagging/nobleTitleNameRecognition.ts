import { buildNobleTitleSearchStrings } from './norbertWikiNt';

/**
 * Recognizes when an authority-sourced alternate name (typically a CBDB/DILA
 * `type="posthumous"` 諡號) is actually a noble title in disguise — e.g. CBDB
 * gives Cao Cao's posthumous name as the flat string "武皇帝", while Norbert's
 * canonical `person_nt` record for the same person already decomposes that
 * exact title into fief "魏" + posthumous name "武" + rank "帝". DILA goes
 * further and includes the fief-prefixed form too, e.g. Liu Bei's "漢昭烈帝".
 *
 * This does NOT invent a general rank-synonym table for tagging (that would
 * risk over-matching free text). It only recognizes a rank spelling variant
 * when checked against a specific person's own already-known Norbert title
 * components, which keeps the match tightly scoped and low-risk — matching
 * still ends at a human-reviewed suggestion, never an automatic rewrite.
 */

/** A person's known noble-title components, as already carried on `AuthorityCandidate.metadata.nobleTitle`. */
export interface KnownNobleTitle {
  placeName: string;
  roleName: string;
  posthumousName?: string;
  dynasty?: string;
  /** The authority record this recognition would cite, e.g. "wiki-nt:2203". */
  ref: string;
}

export interface RecognizedNobleTitle {
  placeName: string;
  /** Canonical rank spelling (Norbert's own), not the variant that matched. */
  roleName: string;
  posthumousName?: string;
  dynasty?: string;
  ref: string;
}

/**
 * Known full-form spellings for a rank whose classical compounding form is
 * shorter (e.g. histories write "武帝", not "武皇帝", but some authorities
 * record the fuller "皇帝"/"皇后"). Extend as more variants are found —
 * this is deliberately a short, curated list, not an open-ended synonym set.
 */
const RANK_SPELLING_VARIANTS: Record<string, readonly string[]> = {
  帝: ['帝', '皇帝'],
  后: ['后', '皇后'],
};

function acceptableRankSpellings(roleName: string): readonly string[] {
  return RANK_SPELLING_VARIANTS[roleName] ?? [roleName];
}

/**
 * Checks one candidate name string against a person's known noble titles.
 * Authorities disagree on how much of the title they store as the "name":
 * CBDB gives Cao Cao's posthumous name as the bare "武皇帝" (posthumous name +
 * rank, no fief), while DILA gives Liu Bei's as the fief-qualified "漢昭烈帝".
 * For each acceptable rank spelling (Norbert's own plus known full-form
 * variants), this checks both the bare form (posthumous name + rank alone)
 * and the fief/dynasty-qualified forms `buildNobleTitleSearchStrings`
 * generates for tagging. Returns the canonical decomposition (Norbert's own
 * rank spelling, not whichever variant matched), so the result is safe to
 * write into `nobleTitle/roleName` as-is.
 */
export function recognizeNobleTitleFromName(
  nameText: string,
  knownTitles: readonly KnownNobleTitle[],
): RecognizedNobleTitle | null {
  const text = nameText.normalize('NFC').trim();
  if (!text) return null;

  for (const title of knownTitles) {
    const roleName = title.roleName?.trim();
    if (!roleName) continue;
    const posthumousName = title.posthumousName?.trim() ?? '';
    for (const spelling of acceptableRankSpellings(roleName)) {
      const bareForms = [`${posthumousName}${spelling}`, spelling];
      const { titleSearchStrings } = buildNobleTitleSearchStrings({
        fief: title.placeName,
        roleName: spelling,
        posthumousName: title.posthumousName,
        dynasty: title.dynasty,
      });
      if (bareForms.includes(text) || titleSearchStrings.includes(text)) {
        return {
          placeName: title.placeName,
          roleName,
          posthumousName: title.posthumousName,
          dynasty: title.dynasty,
          ref: title.ref,
        };
      }
    }
  }
  return null;
}
