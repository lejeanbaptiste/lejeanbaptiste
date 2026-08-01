import type { Suggestion } from './types';

export type DateReviewRecalculate = (suggestions: Suggestion[]) => Promise<Suggestion[]>;

/** In-memory batch for the review walk — kept out of Overmind because the controller mutates status in place. */
let currentBatch: Suggestion[] | null = null;
let currentNotice: string | null = null;
let currentRecalculate: DateReviewRecalculate | null = null;
let currentAuthorityCiv: readonly string[] | null = null;

const cloneSuggestion = (suggestion: Suggestion): Suggestion => ({
  ...suggestion,
  anchor: { ...suggestion.anchor },
  ...(suggestion.attributes ? { attributes: { ...suggestion.attributes } } : {}),
  ...(suggestion.dateResolution
    ? {
        dateResolution: {
          ...suggestion.dateResolution,
          ...(suggestion.dateResolution.editorAttributes
            ? { editorAttributes: { ...suggestion.dateResolution.editorAttributes } }
            : {}),
        },
      }
    : {}),
});

export function stashAutoTaggingBatch(
  suggestions: Suggestion[],
  notice?: string,
  recalculate?: DateReviewRecalculate,
  authorityCiv?: readonly string[],
): void {
  currentBatch = suggestions.map(cloneSuggestion);
  currentNotice = notice ?? null;
  currentRecalculate = recalculate ?? null;
  currentAuthorityCiv = authorityCiv ?? null;
}

/** Add streamed chunk results without disturbing decisions already made in the review panel. */
export function appendAutoTaggingBatch(suggestions: Suggestion[]): void {
  if (!currentBatch) currentBatch = [];
  currentBatch.push(...suggestions.map(cloneSuggestion));
  window.dispatchEvent(
    new CustomEvent('desktop:auto-tagging-review-append', { detail: suggestions }),
  );
}

/** Optional warning shown once when the review panel opens (e.g. truncated tag bomb). */
export function takeAutoTaggingNotice(): string | null {
  const notice = currentNotice;
  currentNotice = null;
  return notice;
}

/** Returns a fresh clone of the stashed batch (stash cleared on {@link clearAutoTaggingBatch}). */
export function takeAutoTaggingBatch(): Suggestion[] {
  if (!currentBatch) return [];
  return currentBatch.map(cloneSuggestion);
}

export function takeDateReviewRecalculate(): DateReviewRecalculate | null {
  return currentRecalculate;
}

export function takeDateAuthorityCiv(): readonly string[] | null {
  return currentAuthorityCiv;
}

export function clearAutoTaggingBatch(): void {
  currentBatch = null;
  currentNotice = null;
  currentRecalculate = null;
  currentAuthorityCiv = null;
}
