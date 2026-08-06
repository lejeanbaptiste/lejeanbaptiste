/**
 * Unfinished AI workflows — hidden in the UI until they are reliable enough
 * for daily use. Flip a flag back to `true` to re-enable that entry point.
 *
 * Application Settings (API keys / prompts) stay available so configuration
 * survives while the workflows are off.
 */
export const AI_UI_FEATURES = {
  /** Tag-bomb "AI curate" checkbox + background scoring in the review panel. */
  tagBombCurate: false,
  /** Auto-tagging dialog "AI suggest" method. */
  suggest: true,
  /** Auto-tagging dialog "AI audit" method — second-guesses existing tags; kept off pending better calibration. */
  audit: false,
  /** Disambiguation launcher "AI curation" checkbox. */
  disambiguationCurate: true,
  /** Translation pane "Generate translation" AI menu. */
  translationGenerate: true,
  /** Suggest a vernacular gloss into the draft field (popup + entity editor). */
  entityGlossSuggest: true,
} as const;

export type AiUiFeature = keyof typeof AI_UI_FEATURES;

export const isAiUiFeatureEnabled = (feature: AiUiFeature): boolean => AI_UI_FEATURES[feature];
