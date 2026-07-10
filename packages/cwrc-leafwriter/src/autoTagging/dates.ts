import { buildDocIndex, collectTextNodes, createAnchor, type DocIndex } from './anchor';
import { buildSearchText } from './normalize';
import { chunkDocument, type Chunk } from './chunk';
import type { Anchor, DateCandidate, DateResolution, Suggestion, WhitespacePolicy } from './types';

/** Tag the whole body in one sanmiao call; split by paragraph only above this size. */
export const DATE_TAG_SPLIT_THRESHOLD_CHARS = 20_000;

export interface SanmiaoProposeOptions {
  civ?: string[];
  sequential?: boolean;
  fuzzy?: boolean;
  tpq?: number;
  taq?: number;
  pg?: boolean;
  lang?: string;
}

export interface SanmiaoProposal {
  date_index: number;
  date_string: string;
  status: 'unique' | 'ambiguous' | 'unresolved' | 'tagged';
  candidates: Array<{
    displayLine: string;
    attrs?: Record<string, string>;
    era_id?: number | null;
    dyn_id?: number | null;
    error_str?: string | null;
  }>;
  attrs?: Record<string, string>;
  parseInnerXml?: string;
}

export type SanmiaoBatchTagFn = (
  chunks: string[],
  options: SanmiaoProposeOptions,
  onChunk?: (event: SanmiaoChunkProgressEvent) => void,
) => Promise<SanmiaoProposal[][]>;

export type SanmiaoBatchResolveFn = (
  dateXml: string[],
  options: SanmiaoProposeOptions,
  onChunk?: (event: SanmiaoChunkProgressEvent) => void,
) => Promise<(SanmiaoProposal | null)[]>;

export type SanmiaoBatchProposeFn = (
  chunks: string[],
  options: SanmiaoProposeOptions,
  onChunk?: (event: SanmiaoChunkProgressEvent) => void,
) => Promise<SanmiaoProposal[][]>;

export type SanmiaoChunkProgressEvent =
  | { type: 'init'; total: number; tablesMs: number }
  | {
      type: 'chunk';
      index: number;
      done: number;
      total: number;
      ms: number;
      chars: number;
      proposals: number;
      skipped: boolean;
    };

export interface DateTagProgress {
  phase: 'starting' | 'chunk' | 'mapping' | 'done';
  done: number;
  total: number;
  tablesMs?: number;
  ms?: number;
  chars?: number;
  proposalsInChunk?: number;
  suggestionsSoFar?: number;
}

export interface DateTagOptions extends SanmiaoProposeOptions {
  onProgress?: (progress: DateTagProgress) => void;
  /** Split by paragraph when taggable body text exceeds this (default 20_000). */
  splitThresholdChars?: number;
}

/** Prefer TEI `<text><body>` over header/front matter. */
export function findTeiBodyRoot(doc: Document): Node {
  const root = doc.documentElement;
  if (!root) return doc;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  while (node) {
    if (node.localName === 'body' && hasAncestorLocalName(node, 'text')) return node;
    node = walker.nextNode() as Element | null;
  }
  return root;
}

function hasAncestorLocalName(node: Element, name: string): boolean {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (el.localName === name) return true;
  }
  return false;
}

/** Document index excluding text already inside `<date>` elements. */
export function buildTaggableDocIndex(root: Node, policy: WhitespacePolicy): DocIndex {
  const all = collectTextNodes(root, policy);
  const nodes = all.filter(({ node }) => !isInsideDateElement(node));
  const nodeStart: number[] = [];
  let total = 0;
  for (const { search } of nodes) {
    nodeStart.push(total);
    total += search.text.length;
  }
  return { nodes, text: nodes.map((n) => n.search.text).join(''), nodeStart };
}

/** TEI entity tags that must not be inserted inside `<date>` (sanmiao owns that subtree). */
export const ENTITY_TAGS_FORBIDDEN_IN_DATE = [
  'persName',
  'placeName',
  'orgName',
  'org',
  'geogName',
  'name',
  'roleName',
  'title',
] as const;

function hasDateAncestor(node: Node): boolean {
  let el: Element | null =
    node.nodeType === Node.TEXT_NODE
      ? (node as Text).parentElement
      : node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
  for (; el; el = el.parentElement) {
    if (el.localName === 'date') return true;
  }
  return false;
}

/** True when `node` sits inside a TEI `<date>` (including subelements like when/orig). */
export function isInsideDateElement(node: Node): boolean {
  return hasDateAncestor(node);
}

export function isEntityTagForbiddenInDate(tag: string): boolean {
  return (ENTITY_TAGS_FORBIDDEN_IN_DATE as readonly string[]).includes(tag);
}

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
): Array<{ proposal: SanmiaoProposal; offset: number }> {
  const matched: Array<{ proposal: SanmiaoProposal; offset: number }> = [];
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
  return { resp: '#ljb-sanmiao', cert: 'low' };
}

function proposalAttributes(proposal: SanmiaoProposal): Record<string, string> {
  if (proposal.status === 'tagged') return tagOnlyAttributes();
  const base: Record<string, string> = { resp: '#ljb-sanmiao' };
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
  const forbidden = new Set(ENTITY_TAGS_FORBIDDEN_IN_DATE);

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
  const raw = el.textContent ?? '';
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
        outerXml: new XMLSerializer().serializeToString(el),
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

function anchorRangeForDateText(text: Text, policy: WhitespacePolicy): { rawStart: number; rawEnd: number } {
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
    suggestions.push(
      resolveProposalToSuggestion(proposal, anchor, counter++, displaySurface),
    );
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
