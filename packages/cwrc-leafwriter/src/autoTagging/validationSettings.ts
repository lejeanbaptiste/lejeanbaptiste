/**
 * AI validation settings for auto-tagging review.
 * Controls whether AI pre-validates suggestions before human review.
 * Persisted per project in jean-baptiste.project.json as `autoTaggingValidation`.
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
  const raw = window.__leafWriterProject?.getAutoTaggingValidationSettings?.();
  if (!raw) return undefined;
  return {
    aiValidation:
      typeof raw.aiValidation === 'boolean' ? raw.aiValidation : DEFAULT_AI_VALIDATION,
    autoAcceptThreshold:
      typeof raw.autoAcceptThreshold === 'number'
        ? raw.autoAcceptThreshold
        : DEFAULT_AUTO_ACCEPT_THRESHOLD,
  };
}

/**
 * Persist validation settings to the project file.
 * Merges with the current value so a partial update (e.g. only `aiValidation`)
 * does not wipe `autoAcceptThreshold`.
 */
export async function persistValidationSettings(
  settings: ValidationSettings,
): Promise<void> {
  const projectFilePath = window.__leafWriterProject?.getProjectFilePath?.();
  if (!projectFilePath || !window.electronAPI?.updateProjectFileConfig) return;
  const merged: ValidationSettings = {
    ...readPersistedValidationSettings(),
    ...settings,
  };
  await window.electronAPI.updateProjectFileConfig(projectFilePath, {
    autoTaggingValidation: merged,
  });
  window.__leafWriterProject?.setAutoTaggingValidationSettings?.(merged);
}
