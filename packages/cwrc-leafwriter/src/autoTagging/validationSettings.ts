/**
 * AI validation settings for auto-tagging review.
 * Controls whether AI pre-validates suggestions before human review.
 */

export interface ValidationSettings {
  /** When true, run AI validation on suggestions before human review. */
  aiValidation?: boolean;
  /** Minimum confidence to auto-accept suggestions (0-1). Default 0.8. */
  autoAcceptThreshold?: number;
}

export const DEFAULT_AI_VALIDATION = true;
export const DEFAULT_AUTO_ACCEPT_THRESHOLD = 0.8;

/** Read validation settings from project configuration. */
export function aiValidationFromSettings(settings?: ValidationSettings): boolean {
  return settings?.aiValidation ?? DEFAULT_AI_VALIDATION;
}

/** Read auto-accept threshold from settings. */
export function autoAcceptThresholdFromSettings(settings?: ValidationSettings): number {
  return settings?.autoAcceptThreshold ?? DEFAULT_AUTO_ACCEPT_THRESHOLD;
}

/** Read validation settings from desktop project API. */
export function readPersistedValidationSettings(): ValidationSettings | undefined {
  // TODO: Wire up to project settings once getAutoTaggingSettings is available
  // For now, return undefined to use defaults
  return undefined;
}

/** Persist validation settings to project file. */
export async function persistValidationSettings(
  settings: ValidationSettings,
): Promise<void> {
  // TODO: Wire up to project settings once setAutoTaggingSettings is available
  // For now, this is a no-op
  console.log('AI validation settings saved (not yet persisted to project):', settings);
}
