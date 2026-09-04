import { applySuggestions, type ApplyOptions } from './apply';
import { buildDocIndex, createCompoundAnchor } from './anchor';
import type { AuthorityCandidate } from './authority';
import { teiTagForCandidate } from './authority';
import { collapseLinkedCandidates, mergeCandidateIntoLookupList } from './authorityOverlap';
import { autoSyncEntitiesToCentral } from './autoSync';
import { dictionaryTag, dictionaryTagProjection, type DictionaryEntry } from './dictionary';
import {
  addEntity,
  addOfficeRelation,
  appendAuthorityIdnos,
  ENTITY_KINDS,
  findEntity,
  LJB_AUTOTAG_RESP,
} from './entities';
import { isLatinSurface } from './disambiguationMatch';
import { normalizeMatchPattern } from './normalize';
import { romanizeFromAuthorityMetadata } from '../utilities/romanize';
import { rationaleForCandidates } from './packLoader';
import type { Suggestion, WhitespacePolicy } from './types';
import { extractPluginOfficeRelations } from '../plugins/officeRelationExtractors';
import { formatNorbertAuthorityValue } from './norbertAuthorityId';
import { preferredEntityPrimaryName } from './nobleTitleHeadword';

/**
 * Dedupe source labels for the pill display. Each input may itself already be
 * a `+`-joined composite (e.g. "CBDB+DILA") from an upstream merge, so this
 * splits on `+` before deduping — otherwise two candidates that both carry
 * "CBDB+DILA" but differ by a stray space or case would both survive as
 * distinct whole-label strings and re-join into "CBDB+CBDB+DILA+DILA".
 * Keys on a case/whitespace/Unicode-form-insensitive form; keeps the
 * first-seen spelling for display.
 */
export function dedupeSourceLabels(sources: string[]): string[] {
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

type NobleTitleComponents = NonNullable<NonNullable<AuthorityCandidate['metadata']>['nobleTitle']>;

/**
 * One authority record generates several search-string forms from the same
 * stored components — a full "fief+posthumousName+roleName" and a bare
 * "fief+roleName" (see `buildNobleTitleSearchStrings`, norbertWikiNt.ts).
 * Both forms share one `metadata.nobleTitle` object, so which form actually
 * matched the document is not otherwise recoverable from the candidate.
 *
 * Using the full components unconditionally would splice authority-sourced
 * text the document never contained (e.g. a full posthumous name) into a
 * span that only matched the bare form. This reconstructs which components
 * the *matched surface text* (`anchor.surface`) actually supports, and
 * returns null — meaning "don't emit compound structure" — when neither
 * known form accounts for it, rather than guessing.
 */
function nobleTitleComponentsForSurface(
  nobleTitle: NobleTitleComponents,
  surface: string,
): NobleTitleComponents | null {
  const { fief, familyName, posthumousName, roleName } = nobleTitle;
  const full = [fief, familyName, posthumousName, roleName].filter(Boolean).join('');
  if (full === surface) return { fief, familyName, posthumousName, roleName };
  const bare = [fief, familyName, roleName].filter(Boolean).join('');
  if (bare === surface) return { fief, familyName, roleName };
  return null;
}

/** Same reconciliation for a person-wrapper's title + trailing name. */
function wrapperComponentsForSurface(
  wrapper: NonNullable<NonNullable<AuthorityCandidate['metadata']>['wrapper']>,
  surface: string,
): NonNullable<NonNullable<AuthorityCandidate['metadata']>['wrapper']>['components'] | null {
  const { nationality, fief, familyName, posthumousName, roleName, templeName, persName } =
    wrapper.components;
  const full = [nationality, fief, familyName, posthumousName, roleName, templeName, persName]
    .filter(Boolean)
    .join('');
  if (full === surface) return wrapper.components;
  const bare = [nationality, fief, familyName, roleName, templeName, persName]
    .filter(Boolean)
    .join('');
  if (bare === surface) return { ...wrapper.components, posthumousName: undefined };
  return null;
}

/** Convert seed matches to tag-stage suggestions (no @key — disambiguation later). */
export function suggestionsFromSeedMatches(matches: SeedMatch[]): Suggestion[] {
  return matches.map((match) => {
    const surface = match.suggestion.anchor.surface;

    const rawWrapper = match.candidates.find((candidate) => candidate.metadata?.wrapper)?.metadata
      ?.wrapper;
    const wrapperComponents = rawWrapper ? wrapperComponentsForSurface(rawWrapper, surface) : null;

    const rawNobleTitle = match.candidates.find(
      (candidate) => !candidate.metadata?.wrapper && candidate.metadata?.teiTag === 'nobleTitle',
    )?.metadata?.nobleTitle;
    const nobleTitle = rawNobleTitle
      ? nobleTitleComponentsForSurface(rawNobleTitle, surface)
      : null;
    const nobleTitleXml = nobleTitle
      ? [
          nobleTitle.fief ? `<placeName>${xmlEscape(nobleTitle.fief)}</placeName>` : '',
          nobleTitle.posthumousName
            ? `<persName type="posthumous">${xmlEscape(nobleTitle.posthumousName)}</persName>`
            : '',
          nobleTitle.familyName
            ? `<persName type="family">${xmlEscape(nobleTitle.familyName)}</persName>`
            : '',
          nobleTitle.roleName ? `<roleName>${xmlEscape(nobleTitle.roleName)}</roleName>` : '',
        ].join('')
      : undefined;
    return {
      ...match.suggestion,
      ...(wrapperComponents
        ? {
            tag: 'name',
            attributes: { type: 'personWrapper', cert: 'unknown' },
            innerXml: wrapperInnerXml({ ...rawWrapper!, components: wrapperComponents }),
          }
        : nobleTitleXml
          ? {
              tag: 'nobleTitle',
              innerXml: nobleTitleXml,
            }
          : {}),
      source: 'authority' as const,
      sourceDetail: dedupeSourceLabels(match.candidates.map((c) => c.source)).join('+'),
      rationale: rationaleForCandidates(match.candidates),
    };
  });
}

/**
 * TEI elements a person-wrapper's components legitimately live in once the
 * component tag-bomb has run. A wrapper compound match only makes sense when
 * both ends of the span sit inside one of these — otherwise the concatenated
 * search string has merely collided with untagged running text.
 */
const WRAPPER_COMPONENT_TAGS = new Set([
  'persName',
  'roleName',
  'placeName',
  'nobleTitle',
  'nationality',
  'name',
  'surname',
  'forename',
  'addName',
  'genName',
  'orgName',
]);

/** True when `node` sits inside a TEI name/title component element. */
function insideWrapperComponent(node: Text): boolean {
  let el: Element | null = node.parentElement;
  for (let depth = 0; el && depth < 4; depth += 1) {
    if (WRAPPER_COMPONENT_TAGS.has(el.localName)) return true;
    el = el.parentElement;
  }
  return false;
}

/** Find wrappers whose full string is now represented by adjacent tagged components. */
export function compoundWrapperSuggestions(
  doc: Document,
  candidates: AuthorityCandidate[],
  policy: WhitespacePolicy,
): SeedMatch[] {
  const index = buildDocIndex(doc, policy);
  const byLocation = new Map<string, SeedMatch>();
  let counter = 0;
  for (const candidate of candidates) {
    if (!candidate.metadata?.wrapper) continue;
    for (const rawSurface of candidate.searchStrings) {
      const surface = normalizeMatchPattern(rawSurface);
      // A genuine wrapper concatenation (fief + rank + name, optionally with a
      // nationality or dynasty prefix) runs to at least three characters. The
      // two-character forms — a bare rank glyph plus a one-character personal
      // name, e.g. 侯 + 道 — collide constantly with unrelated running text
      // (安[侯][道]人), so they never earn a suggestion.
      if ([...surface].length < 3) continue;
      let from = 0;
      while (true) {
        const flatStart = index.text.indexOf(surface, from);
        if (flatStart < 0) break;
        from = flatStart + 1;
        const start = boundaryAt(index, flatStart);
        const end = boundaryAt(index, flatStart + [...surface].length - 1);
        if (!start || !end || start.node === end.node) continue;
        // Both ends must land inside already-tagged name/title components —
        // this pass exists to wrap components that are *already* separate
        // adjacent elements, not to tag a raw character run in body text.
        if (!insideWrapperComponent(start.node) || !insideWrapperComponent(end.node)) continue;
        const key = `${flatStart}\t${surface}`;
        let match = byLocation.get(key);
        if (!match) {
          match = {
            suggestion: {
              id: `wrapper_compound_${counter++}`,
              source: 'authority',
              sourceDetail: candidate.source,
              action: 'add-compound',
              tag: 'name',
              attributes: { type: 'personWrapper', cert: 'unknown' },
              anchor: createCompoundAnchor(
                '',
                doc,
                start.node,
                start.rawStart,
                end.node,
                end.rawEnd,
                surface,
                policy,
                index,
              ),
              rationale: `Concatenated person wrapper candidate from ${candidate.source}`,
              status: 'pending',
            },
            candidates: [],
          };
          byLocation.set(key, match);
        }
        if (
          !match.candidates.some(
            (item) =>
              item.authorityId === candidate.authorityId && item.source === candidate.source,
          )
        ) {
          match.candidates.push(candidate);
        }
      }
    }
  }
  return [...byLocation.values()];
}

function boundaryAt(
  index: ReturnType<typeof buildDocIndex>,
  flatOffset: number,
): { node: Text; rawStart: number; rawEnd: number } | null {
  for (let i = 0; i < index.nodes.length; i++) {
    const start = index.nodeStart[i]!;
    const end = start + index.nodes[i]!.search.text.length;
    if (flatOffset < start || flatOffset >= end) continue;
    const local = flatOffset - start;
    const search = index.nodes[i]!.search;
    return {
      node: index.nodes[i]!.node,
      rawStart: search.map[local]!,
      rawEnd: search.map[local]! + 1,
    };
  }
  return null;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build nested TEI content for a transient wrapper suggestion. */
export function wrapperInnerXml(
  wrapper: NonNullable<NonNullable<AuthorityCandidate['metadata']>['wrapper']>,
): string {
  const components = wrapper.components;
  const nationality = components.nationality
    ? `<nationality>${xmlEscape(components.nationality)}</nationality>`
    : '';
  const titleParts = [
    components.fief ? `<placeName>${xmlEscape(components.fief)}</placeName>` : '',
    components.familyName
      ? `<persName type="family">${xmlEscape(components.familyName)}</persName>`
      : '',
    components.posthumousName
      ? `<persName type="posthumous">${xmlEscape(components.posthumousName)}</persName>`
      : '',
    components.roleName ? `<roleName>${xmlEscape(components.roleName)}</roleName>` : '',
  ].join('');
  const title = titleParts ? `<nobleTitle>${titleParts}</nobleTitle>` : '';
  const temple = components.templeName
    ? `<persName type="temple">${xmlEscape(components.templeName)}</persName>`
    : '';
  return `${nationality}${title}${temple}<persName>${xmlEscape(components.persName)}</persName>`;
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
  for (const rawSurface of candidate.searchStrings) {
    // Match the document search text: NFC, and for Tibetan fold the
    // non-breaking tsheg and drop a terminal tsheg/shad the running text will
    // not carry. The lookup key must use the same form the matcher will report
    // back as `anchor.surface`, or `seedSuggestionsFromIndex` loses the row.
    const surface = normalizeMatchPattern(rawSurface);
    if (!surface) continue;
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

export interface SeedSuggestionsOptions {
  /** Phase B projection matcher (default off until Phase C apply ships). */
  useProjectionMatcher?: boolean;
}

export function seedSuggestionsFromIndex(
  doc: Document,
  index: AuthoritySeedIndex,
  policy: WhitespacePolicy,
  options: SeedSuggestionsOptions = {},
): SeedMatch[] {
  const entries = dedupeDictionaryEntries(index.entries);
  const suggestions = options.useProjectionMatcher
    ? dictionaryTagProjection(doc, entries, policy, 'authority')
    : dictionaryTag(doc, entries, policy, 'authority');
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
    candidate.kind === 'office' ? officeAuthorityIds(candidate) : personAuthorityIds(candidate);
  const memo =
    candidate.metadata?.canonicalEntityId ??
    authorityIds
      .map((id) => `${id.type}:${id.value}`)
      .sort()
      .join('|');
  const already = minted.get(memo);
  if (already) return { id: already, created: false };

  // Scan the entity file for an existing idno match (type compare is case-insensitive).
  for (const idno of Array.from(entitiesDoc.getElementsByTagName('idno'))) {
    if (
      authorityIds.some(
        (authority) =>
          (idno.getAttribute('type') ?? '').trim().toLowerCase() ===
            authority.type.trim().toLowerCase() && idno.textContent === authority.value,
      )
    ) {
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

  const displayName = candidate.displayName?.trim() || candidate.primaryName;
  const typedNames = candidate.names ?? [];
  // Prefer pack personal primary / 姓+名; keep title headwords only as fallback label.
  const mintName =
    candidate.kind === 'person' ? preferredEntityPrimaryName(displayName, typedNames) : displayName;
  const romanizedName = romanizeFromAuthorityMetadata(candidate.metadata, mintName, projectLang);
  const { id } = addEntity(
    entitiesDoc,
    candidate.kind,
    {
      name: mintName,
      nameLang: projectLang && !isLatinSurface(mintName) ? projectLang : undefined,
      romanizedName: romanizedName ?? undefined,
      authorityIds,
      officeTypeIds: candidate.kind === 'office' ? candidate.metadata?.officeTypeIds : undefined,
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
  // Canonical idno types match SOURCE_IDNO_TYPES / SQLite canonicalizeAuthorityType.
  const sourceType = candidate.source.trim().toUpperCase();
  if (!candidate.source.includes('+') && sourceType) {
    const value =
      sourceType === 'NORBERT'
        ? formatNorbertAuthorityValue('office', candidate.authorityId)
        : candidate.authorityId;
    add(sourceType, value);
  }
  add('CBDB', candidate.metadata?.crosswalk?.cbdb);
  const norbertCross = candidate.metadata?.crosswalk?.norbert;
  if (norbertCross) add('NORBERT', formatNorbertAuthorityValue('office', norbertCross));
  return ids;
}

/** Person idnos: primary source plus every pack crosswalk (Norbert ↔ CBDB/DILA/…). */
function personAuthorityIds(candidate: AuthorityCandidate) {
  const ids: { type: string; value: string }[] = [];
  const add = (type: string, value: string | undefined) => {
    if (!value || ids.some((id) => id.type === type && id.value === value)) return;
    ids.push({ type, value });
  };
  const sourceType = candidate.source.trim().toUpperCase();
  if (!candidate.source.includes('+') && sourceType) {
    const value =
      sourceType === 'NORBERT'
        ? formatNorbertAuthorityValue('person', candidate.authorityId)
        : candidate.authorityId;
    add(sourceType, value);
  }
  const crosswalk = candidate.metadata?.crosswalk;
  add('CBDB', crosswalk?.cbdb);
  add('DILA', crosswalk?.dila);
  add('CHGIS', crosswalk?.chgis);
  add('NDL', crosswalk?.ndl);
  add('BDRC', crosswalk?.bdrc);
  add('VIAF', crosswalk?.viaf);
  if (crosswalk?.wikidata) {
    for (const qid of Array.isArray(crosswalk.wikidata)
      ? crosswalk.wikidata
      : [crosswalk.wikidata]) {
      add('Wikidata', qid);
    }
  }
  if (crosswalk?.norbert) {
    add('NORBERT', formatNorbertAuthorityValue('person', crosswalk.norbert));
  }
  const canonical = candidate.metadata?.canonicalEntityId;
  if (canonical?.startsWith(`${candidate.source.toLowerCase()}:person:`)) {
    add(candidate.source, canonical.slice(`${candidate.source.toLowerCase()}:person:`.length));
  }
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
    // A curated title replacement is structural markup, not an authority
    // entity. Applying it must never mint a fictional person/office whose
    // only "name" is a noble title.
    if (candidate.metadata?.isNobleTitle && candidate.metadata?.nobleTitleFilter) continue;
    const { id, created } = resolveEntity(entitiesDoc, candidate, minted, projectLang);
    if (created) {
      entitiesCreated += 1;
      createdIds.push(id);
    }
    const structure = importExplicitOfficeParent(entitiesDoc, id, candidate, minted, projectLang);
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
    importedRelationsCreated + recordAdjacentOfficeRelations(entitiesDoc, officeMentions);

  // One central-store round trip for the whole batch rather than one per
  // entity - seed/import can mint many entities at once.
  await autoSyncEntitiesToCentral(entitiesDoc, createdIds);

  return { linked: links.length, entitiesCreated, relationsCreated, links, snapshot };
}

// Re-export for callers assembling a run.
export { ENTITY_KINDS, findEntity };
