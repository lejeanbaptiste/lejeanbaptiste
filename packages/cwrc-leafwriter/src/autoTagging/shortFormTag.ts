/**
 * Phase-2 person short-form auto-tag: after people are keyed in the active
 * document, hunt for their risky name types (courtesy / given / short 號, …)
 * using dictionary matching at min-length 1. Every hit goes to review — never
 * auto-linked.
 */

import { buildDocIndex, type DocIndex } from './anchor';
import { dictionaryTag, type DictionaryEntry } from './dictionary';
import type { EntitySummary } from './entityOps';
import { isPhase2SeedName, type NameTypeTaggingPolicy } from './nameTypeTaggingPolicy';
import { prepareSuggestionsForReview } from './suggestionFilters';
import type { Suggestion, WhitespacePolicy } from './types';

export interface ShortFormSeedString {
  entityId: string;
  text: string;
  /** Canonical name-type id (e.g. courtesy, given); null for untyped legacy rows. */
  type: string | null;
  /** Primary / display name shown in the review rationale. */
  entityLabel: string;
}

export interface ShortFormTagOptions {
  policy: NameTypeTaggingPolicy;
  whitespacePolicy: WhitespacePolicy;
  /** When true (default), skip matches before each entity's first keyed persName. */
  startFromFirstAppearance?: boolean;
}

/** Document search-text offset for the start/end of an element's text nodes. */
function textRangeForElement(el: Element, index: DocIndex): { start: number; end: number } | null {
  const walker = el.ownerDocument!.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let first: number | null = null;
  let lastEnd: number | null = null;
  let node = walker.nextNode();
  while (node) {
    const nodeIdx = index.nodes.findIndex((n) => n.node === node);
    if (nodeIdx !== -1) {
      const start = index.nodeStart[nodeIdx]!;
      const end = start + index.nodes[nodeIdx]!.search.text.length;
      if (first === null) first = start;
      lastEnd = end;
    }
    node = walker.nextNode();
  }
  if (first === null || lastEnd === null) return null;
  return { start: first, end: lastEnd };
}

/** Map a surface + 1-based occurrence to a span in the document search text. */
function docSpanAt(
  text: string,
  surface: string,
  occurrence: number,
): { start: number; end: number } | null {
  let count = 0;
  let idx = text.indexOf(surface);
  while (idx !== -1) {
    count++;
    if (count === occurrence) return { start: idx, end: idx + surface.length };
    idx = text.indexOf(surface, idx + 1);
  }
  return null;
}

/**
 * Collect entity `@key`s from keyed `<persName>` in the document and record
 * each entity's earliest document search-text offset (the "first appearance"
 * floor for optional post-filtering).
 */
export function keyedPersNameFloors(
  doc: Document,
  whitespacePolicy: WhitespacePolicy,
): Map<string, number> {
  const index = buildDocIndex(doc, whitespacePolicy);
  const floors = new Map<string, number>();
  const root = doc.documentElement ?? doc;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let el = walker.nextNode() as Element | null;
  while (el) {
    if (el.localName === 'persName') {
      const key = el.getAttribute('key')?.trim();
      if (key) {
        const range = textRangeForElement(el, index);
        if (range) {
          const prev = floors.get(key);
          if (prev === undefined || range.start < prev) floors.set(key, range.start);
        }
      }
    }
    el = walker.nextNode() as Element | null;
  }
  return floors;
}

/**
 * Phase-2 seed strings for one entity: typed `<persName>` rows on the entity
 * record plus optional family/given notes when those types are in the phase-2
 * bucket under the active policy.
 */
export function phase2StringsForEntity(
  entity: EntitySummary,
  policy: NameTypeTaggingPolicy,
): ShortFormSeedString[] {
  const entityLabel = entity.names[0] ?? entity.id;
  const out: ShortFormSeedString[] = [];
  const seen = new Set<string>();

  const push = (text: string, type: string | null) => {
    const trimmed = text.trim();
    if (!trimmed || !isPhase2SeedName(type, trimmed, policy)) return;
    const dedupeKey = `${trimmed}\0${type ?? ''}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push({ entityId: entity.id, text: trimmed, type, entityLabel });
  };

  for (const entry of entity.nameEntries) {
    push(entry.text, entry.type);
  }
  if (entity.familyName) push(entity.familyName, 'family');
  if (entity.givenName) push(entity.givenName, 'given');

  return out;
}

function formatShortFormRationale(seed: ShortFormSeedString): string {
  const typePart = seed.type ?? 'untyped';
  return `Short form (${typePart}) of ${seed.entityLabel}`;
}

/**
 * Run short-form tagging on `doc` for the supplied keyed entities. Returns
 * review-ready suggestions (always pending; sourceDetail `short-form`).
 */
export function shortFormTag(
  doc: Document,
  entitiesById: Map<string, EntitySummary>,
  floors: Map<string, number>,
  options: ShortFormTagOptions,
): Suggestion[] {
  const { policy, whitespacePolicy } = options;
  const startFromFirstAppearance = options.startFromFirstAppearance !== false;

  const allSeeds: ShortFormSeedString[] = [];
  for (const entityId of floors.keys()) {
    const entity = entitiesById.get(entityId);
    if (!entity) continue;
    allSeeds.push(...phase2StringsForEntity(entity, policy));
  }

  if (allSeeds.length === 0) return [];

  const seedsBySurface = new Map<string, ShortFormSeedString[]>();
  for (const seed of allSeeds) {
    const bucket = seedsBySurface.get(seed.text) ?? [];
    bucket.push(seed);
    seedsBySurface.set(seed.text, bucket);
  }

  const entries: DictionaryEntry[] = [...seedsBySurface.keys()].map((string) => ({
    string,
    tag: 'persName',
  }));

  const rawMatches = dictionaryTag(doc, entries, whitespacePolicy, 'short-form', 1);
  if (rawMatches.length === 0) return [];

  const index = buildDocIndex(doc, whitespacePolicy);
  const expanded: Suggestion[] = [];
  let counter = 0;

  for (const match of rawMatches) {
    const surface = match.anchor.surface;
    const span = docSpanAt(index.text, surface, match.anchor.occurrence);
    if (!span) continue;

    const claimants = (seedsBySurface.get(surface) ?? []).filter((seed) => {
      if (!startFromFirstAppearance) return true;
      const floor = floors.get(seed.entityId);
      if (floor === undefined) return false;
      return span.start >= floor;
    });

    // One suggestion per eligible entity — same anchor, different keys for review.
    const seenEntity = new Set<string>();
    for (const seed of claimants) {
      if (seenEntity.has(seed.entityId)) continue;
      seenEntity.add(seed.entityId);
      expanded.push({
        ...match,
        id: `short_${counter++}`,
        source: 'authority',
        sourceDetail: 'short-form',
        attributes: { key: seed.entityId },
        rationale: formatShortFormRationale(seed),
        status: 'pending',
      });
    }
  }

  return prepareSuggestionsForReview(doc, whitespacePolicy, expanded).suggestions;
}
