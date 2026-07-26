import { applySuggestions, type ApplyOptions } from './apply';
import type { AuthorityCandidate } from './authority';
import { teiTagForCandidate } from './authority';
import { collapseLinkedCandidates, mergeCandidateIntoLookupList } from './authorityOverlap';
import { autoSyncEntitiesToCentral } from './autoSync';
import { dictionaryTag, type DictionaryEntry } from './dictionary';
import {
  addEntity,
  addOfficeRelation,
  appendAuthorityIdnos,
  ENTITY_KINDS,
  findEntity,
  LJB_AUTOTAG_RESP,
} from './entities';
import { isLatinSurface } from './disambiguationMatch';
import { romanizeFromAuthorityMetadata } from '../utilities/romanize';
import { rationaleForCandidates } from './packLoader';
import type { Suggestion, WhitespacePolicy } from './types';
import { extractPluginOfficeRelations } from '../plugins/officeRelationExtractors';

/**
 * Dedupe source labels for the pill display. Each input may itself already be
 * a `+`-joined composite (e.g. "CBDB+DILA") from an upstream merge, so this
 * splits on `+` before deduping — otherwise two candidates that both carry
 * "CBDB+DILA" but differ by a stray space or case would both survive as
 * distinct whole-label strings and re-join into "CBDB+CBDB+DILA+DILA".
 * Keys on a case/whitespace/Unicode-form-insensitive form; keeps the
 * first-seen spelling for display.
 */
function dedupeSourceLabels(sources: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of sources) {
    for (const part of raw.split('+')) {
      const label = part.trim();
      if (!label) continue;
      const key = label.toLowerCase().normalize('NFKC');
      if (!seen.has(key)) seen.set(key, label);
    }
  }
  return [...seen.values()];
}

/** Convert seed matches to tag-stage suggestions (no @key — disambiguation later). */
export function suggestionsFromSeedMatches(matches: SeedMatch[]): Suggestion[] {
  return matches.map((match) => ({
    ...match.suggestion,
    source: 'authority' as const,
    sourceDetail: dedupeSourceLabels(match.candidates.map((c) => c.source)).join('+'),
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
  /** Office hierarchy assertions gathered from plugin concatenation rules. */
  relationsCreated: number;
  /** Per-mention resolution details (for the decision log). */
  links: ResolvedLink[];
  snapshot: string;
}

export interface AppliedOfficeMention {
  element: Element;
  entityId: string;
  candidate: AuthorityCandidate;
}

function comesBefore(a: Element, b: Element): boolean {
  return Boolean(a.compareDocumentPosition(b) & 4);
}

function elementsAreAdjacent(first: Element, second: Element): boolean {
  let cursor = first.nextSibling;
  while (cursor?.nodeType === 3 && !(cursor.textContent ?? '').trim()) {
    cursor = cursor.nextSibling;
  }
  return cursor === second;
}

export function recordAdjacentOfficeRelations(
  entitiesDoc: Document,
  mentions: AppliedOfficeMention[],
): number {
  const ordered = [...mentions].sort((a, b) =>
    comesBefore(a.element, b.element) ? -1 : comesBefore(b.element, a.element) ? 1 : 0,
  );
  let created = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const first = ordered[i - 1]!;
    const second = ordered[i]!;
    const adjacent = elementsAreAdjacent(first.element, second.element);
    for (const relation of extractPluginOfficeRelations({
      first: first.candidate,
      second: second.candidate,
      adjacent,
    })) {
      const result = addOfficeRelation(entitiesDoc, {
        parentId: first.entityId,
        childId: second.entityId,
        ...relation,
      });
      if (result.created) created += 1;
    }
  }
  return created;
}

/**
 * Find an existing entity for a candidate (by matching <idno type=source>value),
 * or mint a new one. Returns its local id.
 */
function resolveEntity(
  entitiesDoc: Document,
  candidate: AuthorityCandidate,
  minted: Map<string, string>,
  projectLang?: string | null,
): { id: string; created: boolean } {
  const authorityIds =
    candidate.kind === 'office'
      ? officeAuthorityIds(candidate)
      : [{ type: candidate.source, value: candidate.authorityId }];
  const memo =
    candidate.metadata?.canonicalEntityId
    ?? authorityIds.map((id) => `${id.type}:${id.value}`).sort().join('|');
  const already = minted.get(memo);
  if (already) return { id: already, created: false };

  // Scan the entity file for an existing idno match.
  for (const idno of Array.from(entitiesDoc.getElementsByTagName('idno'))) {
    if (authorityIds.some(
      (authority) =>
        idno.getAttribute('type') === authority.type
        && idno.textContent === authority.value,
    )) {
      const owner = idno.parentElement;
      const existing = owner?.getAttribute('xml:id');
      if (existing && owner) {
        const ownIds = new Set(
          Array.from(owner.getElementsByTagName('idno')).map(
            (value) => `${value.getAttribute('type')}\t${value.textContent}`,
          ),
        );
        appendAuthorityIdnos(
          entitiesDoc,
          owner,
          authorityIds.filter((value) => !ownIds.has(`${value.type}\t${value.value}`)),
        );
        minted.set(memo, existing);
        return { id: existing, created: false };
      }
    }
  }

  const romanizedName = romanizeFromAuthorityMetadata(
    candidate.metadata,
    candidate.primaryName,
    projectLang,
  );
  const { id } = addEntity(
    entitiesDoc,
    candidate.kind,
    {
      name: candidate.primaryName,
      nameLang:
        projectLang && !isLatinSurface(candidate.primaryName) ? projectLang : undefined,
      romanizedName: romanizedName ?? undefined,
      authorityIds,
      officeTypeIds: candidate.kind === 'office'
        ? candidate.metadata?.officeTypeIds
        : undefined,
      ...(candidate.metadata
        ? { cache: { source: candidate.source, data: candidate.metadata } }
        : {}),
    },
    LJB_AUTOTAG_RESP,
  );
  minted.set(memo, id);
  return { id, created: true };
}

function officeAuthorityIds(candidate: AuthorityCandidate) {
  const ids: { type: string; value: string }[] = [];
  const add = (type: string, value: string | undefined) => {
    if (!value || ids.some((id) => id.type === type && id.value === value)) return;
    ids.push({ type, value });
  };
  if (!candidate.source.includes('+')) add(candidate.source, candidate.authorityId);
  add('CBDB', candidate.metadata?.crosswalk?.cbdb);
  add('Norbert', candidate.metadata?.crosswalk?.norbert);
  return ids;
}

function importExplicitOfficeParent(
  entitiesDoc: Document,
  childId: string,
  candidate: AuthorityCandidate,
  minted: Map<string, string>,
  projectLang?: string | null,
): { entitiesCreated: number; relationsCreated: number; createdId?: string } {
  const parent = candidate.metadata?.parentOffice;
  if (candidate.kind !== 'office' || !parent) {
    return { entitiesCreated: 0, relationsCreated: 0 };
  }
  const parentCandidate: AuthorityCandidate = {
    source: parent.source,
    authorityId: parent.authorityId,
    kind: 'office',
    primaryName: parent.name,
    searchStrings: [parent.name],
    metadata: {
      entityId: parent.entityId,
      canonicalEntityId: parent.entityId.startsWith('cbdb:') ? parent.entityId : undefined,
    },
  };
  const resolved = resolveEntity(entitiesDoc, parentCandidate, minted, projectLang);
  const relation = addOfficeRelation(entitiesDoc, {
    parentId: resolved.id,
    childId,
    source: 'norbert',
    rule: 'explicit-parent-string',
    sourceIds: [parent.authorityId, candidate.authorityId],
    confidence: 'inferred',
  });
  return {
    entitiesCreated: resolved.created ? 1 : 0,
    relationsCreated: relation.created ? 1 : 0,
    createdId: resolved.created ? resolved.id : undefined,
  };
}

/**
 * Auto-link a set of unique-hit matches: mint/find the entity for each,
 * apply the tags via the existing apply engine (one snapshot / one undo),
 * then stamp `key` onto the created elements. Mutates `doc` and
 * `entitiesDoc`; the caller persists both.
 */
export async function autoLinkUnique(
  doc: Document,
  entitiesDoc: Document,
  matches: SeedMatch[],
  options: ApplyOptions,
  projectLang?: string | null,
): Promise<AutoLinkResult> {
  const minted = new Map<string, string>();
  const byId = new Map<string, { entityId: string; candidate: AuthorityCandidate }>();
  const createdIds: string[] = [];
  let entitiesCreated = 0;
  let importedRelationsCreated = 0;

  for (const match of matches) {
    const candidate = match.candidates[0];
    if (!candidate) continue;
    const { id, created } = resolveEntity(entitiesDoc, candidate, minted, projectLang);
    if (created) {
      entitiesCreated += 1;
      createdIds.push(id);
    }
    const structure = importExplicitOfficeParent(
      entitiesDoc,
      id,
      candidate,
      minted,
      projectLang,
    );
    entitiesCreated += structure.entitiesCreated;
    importedRelationsCreated += structure.relationsCreated;
    if (structure.createdId) createdIds.push(structure.createdId);
    byId.set(match.suggestion.id, { entityId: id, candidate });
  }

  const suggestions = matches.map((m) => m.suggestion);
  const { results, snapshot } = await applySuggestions(doc, suggestions, options);

  const links: ResolvedLink[] = [];
  const officeMentions: AppliedOfficeMention[] = [];
  for (const result of results) {
    if (result.outcome !== 'applied' || !result.element) continue;
    const resolved = byId.get(result.suggestion.id);
    if (!resolved) continue;
    result.element.setAttribute('key', resolved.entityId);
    if (resolved.candidate.kind === 'office') {
      officeMentions.push({
        element: result.element,
        entityId: resolved.entityId,
        candidate: resolved.candidate,
      });
    }
    links.push({
      suggestion: result.suggestion,
      entityId: resolved.entityId,
      source: resolved.candidate.source,
      authorityId: resolved.candidate.authorityId,
    });
  }

  const relationsCreated =
    importedRelationsCreated
    + recordAdjacentOfficeRelations(entitiesDoc, officeMentions);

  // One central-store round trip for the whole batch rather than one per
  // entity - seed/import can mint many entities at once.
  await autoSyncEntitiesToCentral(entitiesDoc, createdIds);

  return { linked: links.length, entitiesCreated, relationsCreated, links, snapshot };
}

// Re-export for callers assembling a run.
export { ENTITY_KINDS, findEntity };
