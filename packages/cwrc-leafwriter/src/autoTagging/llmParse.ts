import type { DocIndex } from './anchor';
import type { RawLlmItem } from './llmCache';
import { foldNonBreakingTsheg, trimTibetanEdgeMarks } from './normalize';

/**
 * Parse and schema-validate a model response. Anything malformed — bad JSON,
 * wrong shape, an out-of-range confidence, a tag/action outside what was
 * requested — is dropped here rather than surfacing a crash or a bogus
 * suggestion. This is layer one of two; layer two is anchor verification
 * (see locateInDoc/findOccurrenceOffset below), applied by the caller.
 */
export function parseValidItems(
  json: string,
  tags: string[],
  allowedActions: string[],
): RawLlmItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as any).suggestions)
  ) {
    return [];
  }

  const tagSet = new Set(tags);
  const actionSet = new Set(allowedActions);
  const items: RawLlmItem[] = [];
  for (const raw of (parsed as { suggestions: unknown[] }).suggestions) {
    if (typeof raw !== 'object' || raw === null) continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.surface !== 'string' || item.surface.length === 0) continue;
    const occurrence =
      typeof item.occurrence === 'number'
        ? item.occurrence
        : typeof item.occurrence === 'string' && /^[1-9]\d*$/.test(item.occurrence)
          ? Number(item.occurrence)
          : null;
    if (occurrence === null || occurrence < 1) continue;
    if (typeof item.tag !== 'string' || !tagSet.has(item.tag)) continue;
    const action =
      typeof item.action === 'string'
        ? item.action
        : allowedActions.length === 1
          ? allowedActions[0]
          : null;
    if (typeof action !== 'string' || !actionSet.has(action)) continue;
    if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) continue;
    if (typeof item.rationale !== 'string') continue;
    items.push({
      surface: item.surface,
      occurrence,
      tag: item.tag,
      action,
      confidence: item.confidence,
      rationale: item.rationale,
    });
  }
  return items;
}

/** Offset (within `text`) of the nth (1-based) occurrence of `surface`, or null if fewer occurrences exist. */
export function findOccurrenceOffset(
  text: string,
  surface: string,
  occurrence: number,
): number | null {
  let idx = -1;
  for (let n = 0; n < occurrence; n++) {
    idx = text.indexOf(surface, idx + 1);
    if (idx === -1) return null;
  }
  return idx;
}

/** A located span in `text`: its offset and its length (which can be shorter than the model's surface). */
export interface OccurrenceMatch {
  offset: number;
  length: number;
}

/**
 * Offset + length of the nth occurrence of `surface` in `text`. Exact match
 * first (identical to `findOccurrenceOffset`, length === surface.length).
 *
 * With `tibetanTolerant`, a failed exact match is retried after (1) folding
 * the non-breaking tsheg U+0F0C to the plain tsheg U+0F0B everywhere — same
 * glyph, a display variant only, and a length-preserving swap so offsets stay
 * valid — and (2) stripping tsheg / shad / whitespace from the surface edges.
 * The model routinely returns a Tibetan mention with or without its boundary
 * tsheg while the source follows the "drop the tsheg before a shad, keep it
 * after ང" orthographic rules, so the raw strings differ by an edge mark even
 * when the mention is right. The returned `length` is the trimmed length, so
 * callers anchor the corrected span, not the model's over-long one.
 */
export function findOccurrenceMatch(
  text: string,
  surface: string,
  occurrence: number,
  options?: { tibetanTolerant?: boolean },
): OccurrenceMatch | null {
  const exact = findOccurrenceOffset(text, surface, occurrence);
  if (exact !== null) return { offset: exact, length: surface.length };
  if (!options?.tibetanTolerant) return null;

  const folded = foldNonBreakingTsheg(text);
  const trimmed = trimTibetanEdgeMarks(foldNonBreakingTsheg(surface));
  if (!trimmed || (trimmed === surface && folded === text)) return null;

  const offset = findOccurrenceOffset(folded, trimmed, occurrence);
  return offset === null ? null : { offset, length: trimmed.length };
}

/**
 * Locate a whole-document search-text span within its owning text node.
 * Returns null if the span crosses a node boundary or doesn't exist — the
 * caller counts that as an unverifiable model claim and drops it.
 */
export function locateInDoc(
  index: DocIndex,
  docStart: number,
  length: number,
): { node: Text; rawStart: number; rawEnd: number } | null {
  let nodeIdx = -1;
  for (let i = 0; i < index.nodes.length; i++) {
    const nodeStart = index.nodeStart[i]!;
    const nodeEnd = nodeStart + index.nodes[i]!.search.text.length;
    if (docStart >= nodeStart && docStart < nodeEnd) {
      nodeIdx = i;
      break;
    }
  }
  if (nodeIdx === -1) return null;

  const docNode = index.nodes[nodeIdx]!;
  const localStart = docStart - index.nodeStart[nodeIdx]!;
  const localEnd = localStart + length;
  if (localEnd > docNode.search.text.length) return null;

  return {
    node: docNode.node,
    rawStart: docNode.search.map[localStart]!,
    rawEnd: docNode.search.map[localEnd - 1]! + 1,
  };
}
