import type { Suggestion } from './types';

/** In-memory batch for the review walk — kept out of Overmind because the controller mutates status in place. */
let currentBatch: Suggestion[] | null = null;
let currentNotice: string | null = null;

const cloneSuggestion = (suggestion: Suggestion): Suggestion => ({
  ...suggestion,
  anchor: { ...suggestion.anchor },
  ...(suggestion.attributes ? { attributes: { ...suggestion.attributes } } : {}),
});

export function stashAutoTaggingBatch(suggestions: Suggestion[], notice?: string): void {
  currentBatch = suggestions.map(cloneSuggestion);
  currentNotice = notice ?? null;
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

export function clearAutoTaggingBatch(): void {
  currentBatch = null;
  currentNotice = null;
}
