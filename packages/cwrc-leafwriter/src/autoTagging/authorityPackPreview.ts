import { teiTagForCandidate } from './authority';
import { DEFAULT_MIN_MATCH_LENGTH } from './dictionary';
import {
  countPackUniqueStrings,
  candidatePassesDateFilter,
  iterateAuthorityNdjson,
  type DateRangeFilter,
  type PackStringCount,
} from './packLoader';
import {
  WIKIDATA_PERSON_CHILD_PACK_IDS,
  type AuthorityPackId,
} from './packPaths';

export type AuthorityPackStringCounts = Partial<Record<AuthorityPackId, PackStringCount>>;

function accumulatePackStrings(
  content: string,
  strings: Set<string>,
  range?: DateRangeFilter,
): number {
  let entities = 0;
  for (const candidate of iterateAuthorityNdjson(content)) {
    if (range && !candidatePassesDateFilter(candidate, range)) continue;
    entities += 1;
    const tag = teiTagForCandidate(candidate);
    for (const surface of candidate.searchStrings) {
      if ([...surface].length < DEFAULT_MIN_MATCH_LENGTH) continue;
      strings.add(`${tag}\0${surface}`);
    }
  }
  return entities;
}

/** Count unique match strings for UI pack rows (expands wikidata-persons across child files). */
export async function countAuthorityPackStrings(
  uiPackIds: AuthorityPackId[],
  readPackFile: (packId: AuthorityPackId) => Promise<string>,
  installedIds: Set<AuthorityPackId>,
  range?: DateRangeFilter,
): Promise<AuthorityPackStringCounts> {
  const out: AuthorityPackStringCounts = {};

  for (const packId of uiPackIds) {
    if (packId === 'wikidata-persons') {
      const strings = new Set<string>();
      let entities = 0;
      let any = false;
      for (const childId of WIKIDATA_PERSON_CHILD_PACK_IDS) {
        if (!installedIds.has(childId)) continue;
        try {
          const content = await readPackFile(childId);
          entities += accumulatePackStrings(content, strings, range);
          any = true;
        } catch {
          // Skip missing/unreadable child packs.
        }
      }
      if (any) out[packId] = { entities, uniqueStrings: strings.size };
      continue;
    }

    if (!installedIds.has(packId)) continue;
    try {
      const content = await readPackFile(packId);
      out[packId] = countPackUniqueStrings(content, range);
    } catch {
      // Pack marked installed but unreadable — leave count blank.
    }
  }

  return out;
}
