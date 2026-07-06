import { buildDocIndex } from './anchor';
import { collectTaggedSpans } from './llmAudit';
import type { Suggestion, WhitespacePolicy } from './types';

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
 * Drop `add` suggestions that would nest (or duplicate) an existing mark of the
 * same tag — e.g. add 行成 as persName when 行成 is already inside
 * <persName>張行成</persName>. Applied after AI producers, before the review panel.
 */
export function filterNestedSameTagAdds(
  doc: Document,
  policy: WhitespacePolicy,
  suggestions: Suggestion[],
): { suggestions: Suggestion[]; dropped: number } {
  const adds = suggestions.filter((s) => s.action === 'add');
  if (adds.length === 0) return { suggestions, dropped: 0 };

  const index = buildDocIndex(doc, policy);
  const tagSet = new Set(adds.map((s) => s.tag));
  const existing = collectTaggedSpans(doc, index, tagSet);

  let dropped = 0;
  const kept = suggestions.filter((s) => {
    if (s.action !== 'add') return true;
    const span = docSpanAt(index.text, s.anchor.surface, s.anchor.occurrence);
    if (!span) return true;
    const nested = existing.some(
      (t) => t.tag === s.tag && span.start >= t.start && span.end <= t.end,
    );
    if (nested) {
      dropped++;
      return false;
    }
    return true;
  });

  return { suggestions: kept, dropped };
}
