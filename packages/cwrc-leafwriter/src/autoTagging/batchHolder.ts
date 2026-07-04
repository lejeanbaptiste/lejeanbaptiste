import type { Suggestion } from './types';

/** In-memory batch for the review walk — kept out of Overmind because the controller mutates status in place. */
let currentBatch: Suggestion[] | null = null;

const cloneSuggestion = (suggestion: Suggestion): Suggestion => ({
  ...suggestion,
  anchor: { ...suggestion.anchor },
  ...(suggestion.attributes ? { attributes: { ...suggestion.attributes } } : {}),
});

export function stashAutoTaggingBatch(suggestions: Suggestion[]): void {
  currentBatch = suggestions.map(cloneSuggestion);
}

/** Returns a fresh clone of the stashed batch (stash cleared on {@link clearAutoTaggingBatch}). */
export function takeAutoTaggingBatch(): Suggestion[] {
  if (!currentBatch) return [];
  return currentBatch.map(cloneSuggestion);
}

export function clearAutoTaggingBatch(): void {
  currentBatch = null;
}
