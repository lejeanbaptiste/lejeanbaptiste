import { applySuggestions, type ApplyOptions } from './apply';
import type { AuthorityCandidate } from './authority';
import { teiTagForCandidate } from './authority';
import { collapseLinkedCandidates, mergeCandidateIntoLookupList } from './authorityOverlap';
import { dictionaryTag, type DictionaryEntry } from './dictionary';
import { addEntity, ENTITY_KINDS, findEntity, LJB_AUTOTAG_RESP } from './entities';
import { rationaleForCandidates } from './packLoader';
import type { Suggestion, WhitespacePolicy } from './types';

/** Convert seed matches to tag-stage suggestions (no @key — disambiguation later). */
export function suggestionsFromSeedMatches(matches: SeedMatch[]): Suggestion[] {
  return matches.map((match) => ({
    ...match.suggestion,
    source: 'authority' as const,
    sourceDetail: [...new Set(match.candidates.map((c) => c.source))].join('+'),
    rationale: rationaleForCandidates(match.candidates),
  }));
}

/** A corpus match with the authority candidate(s) whose name matched there. */
export interface SeedMatch {
  suggestion: Suggestion;
  /** 1 candidate = unique hit; >1 = one-to-many (ambiguous). */
  candidates: AuthorityCandidate[];
}

export interface SeedBuckets {
  /** Exactly one candidate — the fast auto-link bucket. */
  unique: SeedMatch[];
  /** Multiple candidates — queued for interactive disambiguation (4b). */
  ambiguous: SeedMatch[];
}

export interface AuthoritySeedIndex {
  entries: DictionaryEntry[];
  lookup: Map<string, AuthorityCandidate[]>;
}

const seedKeyOf = (tag: string, surface: string) => `${tag}\t${surface}`;

function dedupeDictionaryEntries(entries: DictionaryEntry[]): DictionaryEntry[] {
  const seen = new Map<string, DictionaryEntry>();
  for (const entry of entries) {
    const key = seedKeyOf(entry.tag, entry.string);
    if (!seen.has(key)) seen.set(key, entry);
  }
  return [...seen.values()];
}

function dedupeSeedMatches(matches: SeedMatch[]): SeedMatch[] {
  const seen = new Map<string, SeedMatch>();
  for (const match of matches) {
    const anchor = match.suggestion.anchor;
    const key = `${match.suggestion.tag}\t${anchor.surface}\t${anchor.xpath}\t${anchor.offset}`;
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, match);
      continue;
    }
    prior.candidates = collapseLinkedCandidates([...prior.candidates, ...match.candidates]);
  }
  return [...seen.values()];
}

export function createAuthoritySeedIndex(): AuthoritySeedIndex {
  return { entries: [], lookup: new Map() };
}

/** Add one authority row to a seed index (safe for streaming large packs). */
export function addCandidateToSeedIndex(
  index: AuthoritySeedIndex,
  candidate: AuthorityCandidate,
): void {
  const tag = teiTagForCandidate(candidate);
  for (const surface of candidate.searchStrings) {
    index.entries.push({ string: surface, tag });
    const key = seedKeyOf(tag, surface);
    const list = index.lookup.get(key);
    if (list) {
      mergeCandidateIntoLookupList(list, candidate);
    } else {
      index.lookup.set(key, [candidate]);
    }
  }
}

export function seedSuggestionsFromIndex(
  doc: Document,
  index: AuthoritySeedIndex,
  policy: WhitespacePolicy,
): SeedMatch[] {
  const suggestions = dictionaryTag(
    doc,
    dedupeDictionaryEntries(index.entries),
    policy,
    'authority',
  );
  const matches = suggestions.map((suggestion) => ({
    suggestion,
    candidates: collapseLinkedCandidates(
      index.lookup.get(seedKeyOf(suggestion.tag, suggestion.anchor.surface)) ?? [],
    ),
  }));
  return dedupeSeedMatches(matches);
}

/**
 * Fire authority candidates at the corpus. Reuses the tested dictionary
 * matcher (longest-first, no cross-tag, skips already-tagged spots) and
 * attaches, to each resulting suggestion, the candidate(s) whose search
 * string produced it.
 */
export function seedSuggestions(
  doc: Document,
  candidates: AuthorityCandidate[],
  policy: WhitespacePolicy,
): SeedMatch[] {
  const index = createAuthoritySeedIndex();
  for (const candidate of candidates) addCandidateToSeedIndex(index, candidate);
  return seedSuggestionsFromIndex(doc, index, policy);
}

/** Split matches into the auto-link (unique) and disambiguate (ambiguous) buckets. */
export function bucketSeeds(matches: SeedMatch[]): SeedBuckets {
  const unique: SeedMatch[] = [];
  const ambiguous: SeedMatch[] = [];
  for (const match of matches) {
    (match.candidates.length === 1 ? unique : ambiguous).push(match);
  }
  return { unique, ambiguous };
}

/** One successfully auto-linked mention, for logging/reporting. */
export interface ResolvedLink {
  suggestion: Suggestion;
  entityId: string;
  source: string;
  authorityId: string;
}

export interface AutoLinkResult {
  /** Number of mentions tagged + keyed. */
  linked: number;
  /** Number of new entities minted in the entity file. */
  entitiesCreated: number;
  /** Per-mention resolution details (for the decision log). */
  links: ResolvedLink[];
  snapshot: string;
}

/**
 * Find an existing entity for a candidate (by matching <idno type=source>value),
 * or mint a new one. Returns its local id.
 */
function resolveEntity(
  entitiesDoc: Document,
  candidate: AuthorityCandidate,
  minted: Map<string, string>,
): { id: string; created: boolean } {
  const memo = `${candidate.source}\t${candidate.authorityId}`;
  const already = minted.get(memo);
  if (already) return { id: already, created: false };

  // Scan the entity file for an existing idno match.
  for (const idno of Array.from(entitiesDoc.getElementsByTagName('idno'))) {
    if (idno.getAttribute('type') === candidate.source && idno.textContent === candidate.authorityId) {
      const owner = idno.parentElement;
      const existing = owner?.getAttribute('xml:id');
      if (existing) {
        minted.set(memo, existing);
        return { id: existing, created: false };
      }
    }
  }

  const { id } = addEntity(
    entitiesDoc,
    candidate.kind === 'office' ? 'org' : candidate.kind,
    {
      name: candidate.primaryName,
      authorityIds: [{ type: candidate.source, value: candidate.authorityId }],
      ...(candidate.metadata
        ? { cache: { source: candidate.source, data: candidate.metadata } }
        : {}),
    },
    LJB_AUTOTAG_RESP,
  );
  minted.set(memo, id);
  return { id, created: true };
}

/**
 * Auto-link a set of unique-hit matches: mint/find the entity for each,
 * apply the tags via the existing apply engine (one snapshot / one undo),
 * then stamp `key` + `resp` onto the created elements. Mutates `doc` and
 * `entitiesDoc`; the caller persists both.
 */
export async function autoLinkUnique(
  doc: Document,
  entitiesDoc: Document,
  matches: SeedMatch[],
  options: ApplyOptions,
): Promise<AutoLinkResult> {
  const minted = new Map<string, string>();
  const byId = new Map<string, { entityId: string; candidate: AuthorityCandidate }>();
  let entitiesCreated = 0;

  for (const match of matches) {
    const candidate = match.candidates[0];
    if (!candidate) continue;
    const { id, created } = resolveEntity(entitiesDoc, candidate, minted);
    if (created) entitiesCreated += 1;
    byId.set(match.suggestion.id, { entityId: id, candidate });
  }

  const suggestions = matches.map((m) => m.suggestion);
  const { results, snapshot } = await applySuggestions(doc, suggestions, options);

  const links: ResolvedLink[] = [];
  for (const result of results) {
    if (result.outcome !== 'applied' || !result.element) continue;
    const resolved = byId.get(result.suggestion.id);
    if (!resolved) continue;
    result.element.setAttribute('key', resolved.entityId);
    result.element.setAttribute('resp', LJB_AUTOTAG_RESP);
    links.push({
      suggestion: result.suggestion,
      entityId: resolved.entityId,
      source: resolved.candidate.source,
      authorityId: resolved.candidate.authorityId,
    });
  }

  return { linked: links.length, entitiesCreated, links, snapshot };
}

// Re-export for callers assembling a run.
export { ENTITY_KINDS, findEntity };
