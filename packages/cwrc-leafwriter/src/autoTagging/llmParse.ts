import type { DocIndex } from './anchor';
import type { RawLlmItem } from './llmCache';

/**
 * Parse and schema-validate a model response. Anything malformed — bad JSON,
 * wrong shape, an out-of-range confidence, a tag/action outside what was
 * requested — is dropped here rather than surfacing a crash or a bogus
 * suggestion. This is layer one of two; layer two is anchor verification
 * (see locateInDoc/findOccurrenceOffset below), applied by the caller.
 */
export function parseValidItems(json: string, tags: string[], allowedActions: string[]): RawLlmItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as any).suggestions)) {
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
export function findOccurrenceOffset(text: string, surface: string, occurrence: number): number | null {
  let idx = -1;
  for (let n = 0; n < occurrence; n++) {
    idx = text.indexOf(surface, idx + 1);
    if (idx === -1) return null;
  }
  return idx;
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
