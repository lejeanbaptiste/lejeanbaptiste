import { buildDocIndex, createAnchor, type DocIndex } from './anchor';
import { buildSearchText } from './normalize';
import { chunkDocument, type Chunk } from './chunk';
import { cloneWithHiddenReadingsCleared, textWithoutHiddenReadings } from './hiddenChoiceText';
import {
  buildTaggableDocIndex,
  ENTITY_TAGS_FORBIDDEN_IN_DATE,
  findTeiBodyRoot,
  isInsideDateElement,
} from './dateTeiHelpers';
import type { Anchor, DateCandidate, DateResolution, Suggestion, WhitespacePolicy } from './types';
import type { DateReviewRecalculate } from './batchHolder';
import type {
  DateTagOptions,
  SanmiaoBatchResolveFn,
  SanmiaoBatchTagFn,
  SanmiaoProposal,
  SanmiaoProposeOptions,
} from './sanmiaoDateTypes';

export type {
  DateTagOptions,
  DateTagProgress,
  SanmiaoBatchProposeFn,
  SanmiaoBatchResolveFn,
  SanmiaoBatchTagFn,
  SanmiaoChunkProgressEvent,
  SanmiaoProposal,
  SanmiaoProposeOptions,
} from './sanmiaoDateTypes';

export {
  buildTaggableDocIndex,
  ENTITY_TAGS_FORBIDDEN_IN_DATE,
  findTeiBodyRoot,
  isEntityTagForbiddenInDate,
  isInsideDateElement,
} from './dateTeiHelpers';

/** Tag the whole body in one sanmiao call; split by paragraph only above this size. */
export const DATE_TAG_SPLIT_THRESHOLD_CHARS = 20_000;

/** Map a flat offset in taggable search text to raw text-node offsets. */
export function offsetToRawRange(
  index: DocIndex,
  offset: number,
  length: number,
): { node: Text; rawStart: number; rawEnd: number } | null {
  if (length <= 0) return null;
  for (let i = 0; i < index.nodes.length; i++) {
    const nodeStart = index.nodeStart[i]!;
    const nodeEnd = nodeStart + index.nodes[i]!.search.text.length;
    if (offset >= nodeStart && offset + length <= nodeEnd) {
      const localStart = offset - nodeStart;
      const { search } = index.nodes[i]!;
      const rawStart = search.map[localStart]!;
      const rawEnd = search.map[localStart + length - 1]! + 1;
      return { node: index.nodes[i]!.node, rawStart, rawEnd };
    }
  }
  return null;
}

/** Walk proposals in order, finding each date_string at the next offset in taggable text. */
export function sequentialMatchOffsets(
  text: string,
  proposals: SanmiaoProposal[],
): { proposal: SanmiaoProposal; offset: number }[] {
  const matched: { proposal: SanmiaoProposal; offset: number }[] = [];
  let pos = 0;
  for (const proposal of proposals) {
    const surface = proposal.date_string;
    if (!surface) continue;
    const idx = text.indexOf(surface, pos);
    if (idx === -1) continue;
    matched.push({ proposal, offset: idx });
    pos = idx + surface.length;
  }
  return matched;
}

function tagOnlyAttributes(): Record<string, string> {
  return { resp: '#grognard-sanmiao', cert: 'low' };
}

function proposalAttributes(proposal: SanmiaoProposal): Record<string, string> {
  if (proposal.status === 'tagged') return tagOnlyAttributes();
  const base: Record<string, string> = { resp: '#grognard-sanmiao' };
  if (proposal.status === 'unique' && proposal.attrs) {
    return { ...base, cert: 'high', ...proposal.attrs };
  }
  if (proposal.status === 'ambiguous') {
    return { ...base, cert: 'low' };
  }
  return { ...base, cert: 'low' };
}

function proposalRationale(proposal: SanmiaoProposal): string {
  if (proposal.status === 'tagged') {
    return 'Parse structure only — resolve calendar dates in a second pass.';
  }
  const lines = proposal.candidates.map((c) => c.displayLine).filter(Boolean);
  if (proposal.status === 'unique' && lines[0]) return lines[0];
  if (proposal.status === 'ambiguous' && lines.length > 0) {
    return `${lines.length} interpretations:\n${lines.join('\n')}`;
  }
  if (lines[0]) return lines[0];
  return `Unresolved date: ${proposal.date_string}`;
}

function toDateResolution(proposal: SanmiaoProposal): DateResolution {
  const candidates: DateCandidate[] = proposal.candidates.map((c) => ({
    displayLine: c.displayLine,
    attrs: c.attrs,
    ...(c.era_id != null ? { era_id: c.era_id } : {}),
    ...(c.dyn_id != null ? { dyn_id: c.dyn_id } : {}),
    ...(c.error_str ? { error_str: c.error_str } : {}),
  }));
  return {
    status: proposal.status === 'tagged' ? 'tagged' : proposal.status,
    candidates,
    ...(proposal.parseInnerXml ? { parseXml: sanitizeDateParseXml(proposal.parseInnerXml) } : {}),
  };
}

function sanitizeDateParseXml(parseInnerXml: string): string {
  const xml = new DOMParser().parseFromString(`<root>${parseInnerXml}</root>`, 'application/xml');
  const root = xml.documentElement;
  const walker = xml.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const forbidden = new Set<string>(ENTITY_TAGS_FORBIDDEN_IN_DATE);

  const toRemove: Element[] = [];
  let node = walker.nextNode() as Element | null;
  while (node) {
    if (forbidden.has(node.localName)) {
      toRemove.push(node);
    }
    node = walker.nextNode() as Element | null;
  }

  for (const el of toRemove) {
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  return Array.from(root.childNodes)
    .map((child) => new XMLSerializer().serializeToString(child))
    .join('');
}

function proposalsToSuggestions(
  bodyRoot: Node,
  index: DocIndex,
  chunkText: string,
  chunkStart: number,
  proposals: SanmiaoProposal[],
  counterStart: number,
  policy: WhitespacePolicy,
): { suggestions: Suggestion[]; nextCounter: number } {
  const matched = sequentialMatchOffsets(chunkText, proposals);
  const suggestions: Suggestion[] = [];
  let counter = counterStart;

  for (const { proposal, offset } of matched) {
    const globalOffset = chunkStart + offset;
    const range = offsetToRawRange(index, globalOffset, proposal.date_string.length);
    if (!range) continue;
    if (isInsideDateElement(range.node)) continue;

    suggestions.push({
      id: `date_${counter++}`,
      source: 'dates',
      sourceDetail: 'sanmiao',
      action: 'add',
      tag: 'date',
      attributes: proposalAttributes(proposal),
      anchor: createAnchor('', bodyRoot, range.node, range.rawStart, range.rawEnd, policy, index),
      rationale: proposalRationale(proposal),
      status: 'pending',
      dateResolution: toDateResolution(proposal),
    });
  }

  return { suggestions, nextCounter: counter };
}

/** One whole-body chunk, or paragraph chunks when the taggable text is very long. */
export function buildDateTagChunks(
  doc: Document,
  bodyRoot: Node,
  index: DocIndex,
  policy: WhitespacePolicy,
  splitThresholdChars = DATE_TAG_SPLIT_THRESHOLD_CHARS,
): Chunk[] {
  if (index.text.length <= splitThresholdChars) {
    return [
      {
        id: 'chunk_body',
        start: 0,
        end: index.text.length,
        text: index.text,
        before: '',
        after: '',
      },
    ];
  }

  return chunkDocument(doc, {
    policy,
    root: bodyRoot,
    maxBlocksPerChunk: 1,
  }).filter((c) => c.text.length > 0);
}

/**
 * Phase 1 — tag only: send taggable body text to sanmiao, map spans to suggestions
 * with parse structure only (`cert="low"`, no calendar resolution).
 */
export async function dateTagOnlyFromSanmiao(
  doc: Document,
  policy: WhitespacePolicy,
  batchTag: SanmiaoBatchTagFn,
  options: DateTagOptions = {},
): Promise<Suggestion[]> {
  return runDateTagPass(doc, policy, batchTag, options);
}

/** @deprecated Alias for {@link dateTagOnlyFromSanmiao}. */
export const dateTagFromSanmiao = dateTagOnlyFromSanmiao;

async function runDateTagPass(
  doc: Document,
  policy: WhitespacePolicy,
  batchTag: SanmiaoBatchTagFn,
  options: DateTagOptions = {},
): Promise<Suggestion[]> {
  const bodyRoot = findTeiBodyRoot(doc);
  const index = buildTaggableDocIndex(bodyRoot, policy);
  if (index.text.length === 0) return [];

  const { onProgress, splitThresholdChars, ...sanmiaoOpts } = options;
  const chunks = buildDateTagChunks(
    doc,
    bodyRoot,
    index,
    policy,
    splitThresholdChars ?? DATE_TAG_SPLIT_THRESHOLD_CHARS,
  );

  if (chunks.length === 0) return [];
  const proposeOpts: SanmiaoProposeOptions = {
    sequential: true,
    fuzzy: false,
    civ: ['c', 'j', 'k'],
    ...sanmiaoOpts,
  };

  onProgress?.({ phase: 'starting', done: 0, total: chunks.length });

  const batchResults = await batchTag(
    chunks.map((c) => c.text),
    proposeOpts,
    (event) => {
      if (event.type === 'init') {
        onProgress?.({
          phase: 'starting',
          done: 0,
          total: event.total,
          tablesMs: event.tablesMs,
        });
        return;
      }
      onProgress?.({
        phase: 'chunk',
        done: event.done,
        total: event.total,
        ms: event.ms,
        chars: event.chars,
        proposalsInChunk: event.proposals,
      });
    },
  );

  const suggestions: Suggestion[] = [];
  let counter = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const proposals = batchResults[i] ?? [];
    const { suggestions: chunkSuggestions, nextCounter } = proposalsToSuggestions(
      bodyRoot,
      index,
      chunk.text,
      chunk.start,
      proposals,
      counter,
      policy,
    );
    suggestions.push(...chunkSuggestions);
    counter = nextCounter;
  }

  onProgress?.({
    phase: 'mapping',
    done: chunks.length,
    total: chunks.length,
    suggestionsSoFar: suggestions.length,
  });

  onProgress?.({
    phase: 'done',
    done: chunks.length,
    total: chunks.length,
    suggestionsSoFar: suggestions.length,
  });

  return suggestions;
}

/** One `<date>` element in document order with serialized markup for sanmiao resolve. */
export interface BodyDateEntry {
  element: Element;
  surface: string;
  outerXml: string;
}

/** Plain-text content of a `<date>` element under the whitespace policy. */
export function dateElementSurface(el: Element, policy: WhitespacePolicy): string {
  const raw = textWithoutHiddenReadings(el);
  if (policy === 'ignore') return raw.replace(/\s+/g, '');
  return buildSearchText(raw, policy).text.trim();
}

/** Walk the TEI body and collect every `<date>` in document order. */
export function collectBodyDatesInOrder(bodyRoot: Node, policy: WhitespacePolicy): BodyDateEntry[] {
  const doc = bodyRoot.ownerDocument ?? (bodyRoot as Document);
  const walker = doc.createTreeWalker(bodyRoot, NodeFilter.SHOW_ELEMENT);
  const entries: BodyDateEntry[] = [];
  let node = walker.nextNode();
  while (node) {
    const el = node as Element;
    if (el.localName === 'date') {
      entries.push({
        element: el,
        surface: dateElementSurface(el, policy),
        outerXml: new XMLSerializer().serializeToString(cloneWithHiddenReadingsCleared(el)),
      });
    }
    node = walker.nextNode();
  }
  return entries;
}

function firstTextNodeIn(element: Element): Text | null {
  const doc = element.ownerDocument;
  if (!doc) return null;
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    if (text.data.trim()) return text;
    node = walker.nextNode();
  }
  return null;
}

function anchorRangeForDateText(
  text: Text,
  policy: WhitespacePolicy,
): { rawStart: number; rawEnd: number } {
  const search = buildSearchText(text.data, policy);
  if (search.text.length === 0) return { rawStart: 0, rawEnd: 0 };
  const parentName = text.parentElement?.localName;
  if (parentName === 'year' && search.text.length > 1) {
    const rawStart = search.map[0] ?? 0;
    return { rawStart, rawEnd: rawStart + 1 };
  }
  const rawStart = search.map[0] ?? 0;
  const rawEnd = (search.map[search.text.length - 1] ?? rawStart) + 1;
  return { rawStart, rawEnd };
}

/**
 * Anchor the first text node inside an existing `<date>` for resolve-date apply.
 * The anchor surface matches that node (e.g. "魏" inside `<dyn>`) so resolveAnchor
 * can verify it; use `dateResolution.displaySurface` for the full date string in UI.
 */
export function anchorForDateElement(
  dateEl: Element,
  bodyRoot: Node,
  policy: WhitespacePolicy,
  prebuiltIndex?: DocIndex,
): Anchor | null {
  const textNode = firstTextNodeIn(dateEl);
  if (!textNode) return null;
  const search = buildSearchText(textNode.data, policy);
  if (search.text.length === 0) return null;
  const { rawStart, rawEnd } = anchorRangeForDateText(textNode, policy);
  try {
    return createAnchor('', bodyRoot, textNode, rawStart, rawEnd, policy, prebuiltIndex);
  } catch {
    return null;
  }
}

function resolveProposalToSuggestion(
  proposal: SanmiaoProposal,
  anchor: Anchor,
  counter: number,
  displaySurface?: string,
): Suggestion {
  const dateResolution = toDateResolution(proposal);
  if (displaySurface) dateResolution.displaySurface = displaySurface;
  return {
    id: `date_resolve_${counter}`,
    source: 'dates',
    sourceDetail: 'sanmiao-resolve',
    action: 'resolve-date',
    tag: 'date',
    attributes: proposalAttributes(proposal),
    anchor,
    rationale: proposalRationale(proposal),
    status: 'pending',
    dateResolution,
  };
}

/**
 * Phase 2 — resolve existing `<date>` markup in document order with sequential
 * implied context (fixes relative dates after user-added anchors).
 */
export async function dateResolveFromDocument(
  doc: Document,
  policy: WhitespacePolicy,
  batchResolve: SanmiaoBatchResolveFn,
  options: DateTagOptions = {},
): Promise<Suggestion[]> {
  const bodyRoot = findTeiBodyRoot(doc);
  const entries = collectBodyDatesInOrder(bodyRoot, policy);
  if (entries.length === 0) return [];

  const { onProgress, ...sanmiaoOpts } = options;
  const resolveOpts: SanmiaoProposeOptions = {
    sequential: true,
    fuzzy: false,
    civ: ['c', 'j', 'k'],
    ...sanmiaoOpts,
  };

  onProgress?.({ phase: 'starting', done: 0, total: entries.length });

  const proposals = await batchResolve(
    entries.map((entry) => entry.outerXml),
    resolveOpts,
    (event) => {
      if (event.type === 'init') {
        onProgress?.({
          phase: 'starting',
          done: 0,
          total: event.total,
          tablesMs: event.tablesMs,
        });
        return;
      }
      onProgress?.({
        phase: 'chunk',
        done: event.done,
        total: event.total,
        ms: event.ms,
        chars: event.chars,
        proposalsInChunk: event.proposals,
      });
    },
  );

  const index = buildDocIndex(bodyRoot, policy);
  const suggestions: Suggestion[] = [];
  let counter = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const proposal = proposals[i];
    if (!proposal) continue;
    const anchor = anchorForDateElement(entry.element, bodyRoot, policy, index);
    if (!anchor) continue;
    const displaySurface = proposal.date_string || entry.surface;
    suggestions.push(resolveProposalToSuggestion(proposal, anchor, counter++, displaySurface));
  }

  onProgress?.({
    phase: 'mapping',
    done: entries.length,
    total: entries.length,
    suggestionsSoFar: suggestions.length,
  });

  onProgress?.({
    phase: 'done',
    done: entries.length,
    total: entries.length,
    suggestionsSoFar: suggestions.length,
  });

  return suggestions;
}

/** Empty a working `<date>` so it does not contribute sequential implied state. */
export function clearDateElementForSequence(element: Element): void {
  while (element.firstChild) element.removeChild(element.firstChild);
  for (const name of Array.from(element.attributes).map((attr) => attr.name)) {
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    element.removeAttribute(name);
  }
}

/** Drop calendar-resolution attrs but keep parse children (era/year/…) for re-resolve. */
export function stripDateResolutionAttributes(element: Element): void {
  for (const name of Array.from(element.attributes).map((attr) => attr.name)) {
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    element.removeAttribute(name);
  }
}

/**
 * Indices of dates that must be blanked in a working resolve so a later row can
 * inherit from an earlier attach target (skip flashbacks in between).
 */
export function sequenceSuppressedIndices(current: Suggestion[]): Set<number> {
  const suppressed = new Set<number>();
  for (let n = 0; n < current.length; n++) {
    const attach = current[n]?.dateResolution?.attachToDateIndex;
    if (typeof attach !== 'number' || attach < 0 || attach >= n) continue;
    for (let i = attach + 1; i < n; i++) suppressed.add(i);
  }
  return suppressed;
}

/** Auto-accepted unique row — safe to re-resolve when an earlier anchor changes. */
export function isAutoUniqueAccepted(suggestion: Suggestion): boolean {
  return (
    suggestion.status === 'accepted' &&
    suggestion.dateResolution?.status === 'unique' &&
    !isUserLockedDate(suggestion)
  );
}

/**
 * Curator has locked an interpretation (dropdown pick and/or Accept on
 * ambiguous/unresolved). Later recalculation must keep this row intact.
 */
export function isUserLockedDate(suggestion: Suggestion): boolean {
  if (suggestion.status === 'rejected' || suggestion.status === 'unresolvable') return false;
  if (!suggestionHasConfirmingDateAttrs(suggestion)) return false;
  const resolution = suggestion.dateResolution;
  if (!resolution) return false;
  if (resolution.userLocked) return true;
  // Pre-flag rows: ambiguous/unresolved with an explicit candidate pick.
  return (
    (resolution.status === 'ambiguous' || resolution.status === 'unresolved') &&
    resolution.selectedCandidateIndex != null
  );
}

function preserveAttachChoice(from: Suggestion, onto: Suggestion): void {
  const attach = from.dateResolution?.attachToDateIndex;
  if (typeof attach === 'number' && onto.dateResolution) {
    onto.dateResolution.attachToDateIndex = attach;
  }
}

/**
 * Build the in-panel recalculation operation. Confirmed rows are copied onto
 * a working document as hard Sanmiao attributes; excluded rows become empty
 * date elements so they do not alter sequential implied state. The live
 * document is never mutated until the user presses Apply.
 *
 * User-locked rows (disambiguated 建元元年, etc.) keep their curator state
 * forever for this review pass. Auto-accepted unique rows that follow an
 * earlier confirming date have their resolution attributes stripped so Sanmiao
 * can re-derive them (e.g. 四年 after the user picks 建元元年).
 *
 * When a row sets `attachToDateIndex`, intervening dates are blanked for this
 * pass (flashback skip) and kept as-is in the merge so only the attaching row
 * (and later open rows) refresh from the repaired sequence.
 */
export function createDateReviewRecalculator(
  doc: Document,
  policy: WhitespacePolicy,
  batchResolve: SanmiaoBatchResolveFn,
  options: DateTagOptions = {},
): DateReviewRecalculate {
  return async (current) => {
    const sourceBody = findTeiBodyRoot(doc);
    const sourceEntries = collectBodyDatesInOrder(sourceBody, policy);
    const workingDoc = doc.cloneNode(true) as Document;
    const workingBody = findTeiBodyRoot(workingDoc);
    const workingEntries = collectBodyDatesInOrder(workingBody, policy);
    const sourceAnchors = sourceEntries.map((entry) =>
      anchorForDateElement(entry.element, sourceBody, policy),
    );
    const byAnchor = new Map(current.map((suggestion) => [suggestion.anchor.xpath, suggestion]));
    const indexByAnchor = new Map(
      current.map((suggestion, index) => [suggestion.anchor.xpath, index]),
    );
    const suppressed = sequenceSuppressedIndices(current);
    let seenConfirmingAnchor = false;
    const strippedDependentUniques = new Set<number>();

    for (let i = 0; i < workingEntries.length; i++) {
      const suggestion = sourceAnchors[i] ? byAnchor.get(sourceAnchors[i]!.xpath) : undefined;
      const element = workingEntries[i]?.element;
      if (!element) continue;
      const batchIndex =
        sourceAnchors[i] != null ? indexByAnchor.get(sourceAnchors[i]!.xpath) : undefined;
      if (suggestion?.status === 'rejected' || (batchIndex != null && suppressed.has(batchIndex))) {
        clearDateElementForSequence(element);
        continue;
      }
      if (!suggestionHasConfirmingDateAttrs(suggestion)) continue;

      // Dependent auto-uniques keep stale era/year attrs unless we strip them —
      // otherwise Sanmiao treats the old reading as hard and 四年 never updates.
      // Never strip a user-locked disambiguation.
      if (
        seenConfirmingAnchor &&
        suggestion &&
        isAutoUniqueAccepted(suggestion) &&
        !isUserLockedDate(suggestion)
      ) {
        stripDateResolutionAttributes(element);
        if (batchIndex != null) strippedDependentUniques.add(batchIndex);
        continue;
      }

      for (const [name, value] of Object.entries(suggestion!.attributes ?? {})) {
        if (value) element.setAttribute(name, value);
      }
      seenConfirmingAnchor = true;
    }

    const fresh = await dateResolveFromDocument(workingDoc, policy, batchResolve, options);
    const freshByAnchor = new Map(fresh.map((suggestion) => [suggestion.anchor.xpath, suggestion]));
    const merged: Suggestion[] = [];

    for (let index = 0; index < current.length; index++) {
      const suggestion = current[index]!;
      if (suggestion.status === 'rejected') {
        merged.push(suggestion);
        continue;
      }
      // Flashback (or other intervening) rows blanked for someone else's attach —
      // keep their curator state; their fresh resolve in this pass is meaningless.
      if (suppressed.has(index)) {
        merged.push(suggestion);
        freshByAnchor.delete(suggestion.anchor.xpath);
        continue;
      }
      const next = freshByAnchor.get(suggestion.anchor.xpath);
      if (isUserLockedDate(suggestion)) {
        // Locked interpretation must survive later disambiguation of other rows.
        merged.push(suggestion);
        if (next) freshByAnchor.delete(suggestion.anchor.xpath);
        continue;
      }
      if (!next) continue;
      if (suggestion.status === 'accepted' && !strippedDependentUniques.has(index)) {
        next.status = 'accepted';
        next.attributes = { ...(suggestion.attributes ?? {}) };
        if (suggestion.dateResolution?.editorAttributes) {
          next.dateResolution!.editorAttributes = {
            ...suggestion.dateResolution.editorAttributes,
          };
        }
        if (suggestion.dateResolution?.selectedCandidateIndex != null) {
          next.dateResolution!.selectedCandidateIndex =
            suggestion.dateResolution.selectedCandidateIndex;
        }
        preserveAttachChoice(suggestion, next);
        merged.push(next);
      } else {
        // Stripped auto-uniques and open rows take the fresh Norbert reading.
        preserveAttachChoice(suggestion, next);
        merged.push(next);
      }
      freshByAnchor.delete(suggestion.anchor.xpath);
    }
    merged.push(...freshByAnchor.values());
    return merged;
  };
}

/** Accepted, or pending with a finalized candidate selection (attrs ready for Sanmiao). */
export function suggestionHasConfirmingDateAttrs(suggestion: Suggestion | undefined): boolean {
  if (!suggestion || suggestion.status === 'rejected' || suggestion.status === 'unresolvable') {
    return false;
  }
  const attrs = suggestion.attributes;
  if (!attrs) return false;
  return Object.keys(attrs).some((key) => key !== 'resp' && key !== 'cert' && Boolean(attrs[key]));
}
