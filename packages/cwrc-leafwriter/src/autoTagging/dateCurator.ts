import type { DateResolution, Suggestion } from './types';

const SANMIAO_RESP = '#ljb-sanmiao';

/** True when every suggestion is a sanmiao resolve pass — use the date curator UI. */
export function isDateCuratorBatch(suggestions: Suggestion[]): boolean {
  return (
    suggestions.length > 0 &&
    suggestions.every(
      (s) => s.source === 'dates' && s.action === 'resolve-date' && !!s.dateResolution,
    )
  );
}

/** True when suggestions are tag-only (parse structure, no resolution yet). */
export function isDateTagOnlyBatch(suggestions: Suggestion[]): boolean {
  return (
    suggestions.length > 0 &&
    suggestions.every(
      (s) =>
        s.source === 'dates' &&
        s.action === 'add' &&
        (s.dateResolution?.status === 'tagged' || !s.dateResolution?.candidates?.length),
    )
  );
}

/** Default candidate index for a date row (unique → 0; ambiguous/unresolved → none until chosen). */
export function defaultDateCandidateIndex(resolution: DateResolution): number | null {
  if (resolution.status === 'unique') return 0;
  if (typeof resolution.selectedCandidateIndex === 'number') return resolution.selectedCandidateIndex;
  return null;
}

/** Whether the user must pick a candidate before accepting. */
export function dateCuratorNeedsChoice(suggestion: Suggestion): boolean {
  const resolution = suggestion.dateResolution;
  if (!resolution) return false;
  if (resolution.status === 'unique') return false;
  const candidates = resolution.candidates ?? [];
  return candidates.length > 1;
}

/** Whether accept is allowed for the current curator state. */
export function canAcceptDateSuggestion(
  suggestion: Suggestion,
  selectedCandidateIndex: number | null,
): boolean {
  const resolution = suggestion.dateResolution;
  if (!resolution) return true;
  if (resolution.status === 'unique') return true;
  const candidates = resolution.candidates ?? [];
  if (candidates.length === 0) return true;
  if (candidates.length === 1) return true;
  return (
    selectedCandidateIndex != null &&
    selectedCandidateIndex >= 0 &&
    selectedCandidateIndex < candidates.length
  );
}

/**
 * Merge the user's candidate pick into attributes before apply.
 * Mutates `suggestion` in place so the review controller keeps one object graph.
 */
export function finalizeDateSuggestion(
  suggestion: Suggestion,
  selectedCandidateIndex: number | null,
): Suggestion {
  const resolution = suggestion.dateResolution;
  if (!resolution) return suggestion;

  const candidates = resolution.candidates ?? [];
  let index = selectedCandidateIndex;
  if (resolution.status === 'unique') {
    index = 0;
  } else if (index == null && candidates.length === 1) {
    index = 0;
  }

  if (index != null && candidates[index]) {
    const candidate = candidates[index]!;
    suggestion.attributes = {
      resp: SANMIAO_RESP,
      cert: resolution.status === 'unresolved' ? 'low' : 'high',
      ...(candidate.attrs ?? {}),
    };
    resolution.selectedCandidateIndex = index;
  }

  return suggestion;
}

/** Accepted dates that appear earlier in the batch (for unresolved-relative context). */
export function priorAcceptedDates(
  suggestions: Suggestion[],
  currentId: string,
): Array<{ index: number; surface: string; label: string }> {
  const currentIndex = suggestions.findIndex((s) => s.id === currentId);
  if (currentIndex <= 0) return [];

  const prior: Array<{ index: number; surface: string; label: string }> = [];
  for (let i = 0; i < currentIndex; i++) {
    const s = suggestions[i]!;
    if (s.status !== 'accepted' || s.tag !== 'date') continue;
    const line =
      s.dateResolution?.candidates?.[s.dateResolution.selectedCandidateIndex ?? 0]?.displayLine ??
      s.rationale ??
      s.anchor.surface;
    prior.push({ index: i, surface: s.anchor.surface, label: line });
  }
  return prior;
}
