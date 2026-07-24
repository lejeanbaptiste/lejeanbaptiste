import {
  aiValidationFromSettings,
  autoAcceptThresholdFromSettings,
  DEFAULT_AI_VALIDATION,
  DEFAULT_AUTO_ACCEPT_THRESHOLD,
} from './validationSettings';

describe('validationSettings', () => {
  it('defaults AI validation to on', () => {
    expect(aiValidationFromSettings(undefined)).toBe(DEFAULT_AI_VALIDATION);
    expect(aiValidationFromSettings({})).toBe(true);
    expect(aiValidationFromSettings({ aiValidation: false })).toBe(false);
  });

  it('defaults auto-accept threshold', () => {
    expect(autoAcceptThresholdFromSettings(undefined)).toBe(DEFAULT_AUTO_ACCEPT_THRESHOLD);
    expect(autoAcceptThresholdFromSettings({ autoAcceptThreshold: 0.5 })).toBe(0.5);
  });
});
