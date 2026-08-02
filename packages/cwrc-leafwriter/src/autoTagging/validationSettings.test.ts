import {
  aiValidationFromSettings,
  autoAcceptThresholdFromSettings,
  curateRejectBelowFromSettings,
  DEFAULT_AI_VALIDATION,
  DEFAULT_AUTO_ACCEPT_THRESHOLD,
  DEFAULT_CURATE_REJECT_BELOW,
} from './validationSettings';

describe('validationSettings', () => {
  it('defaults AI curate to off (opt-in on tag bomb)', () => {
    expect(aiValidationFromSettings(undefined)).toBe(DEFAULT_AI_VALIDATION);
    expect(aiValidationFromSettings({})).toBe(false);
    expect(aiValidationFromSettings({ aiValidation: true })).toBe(true);
  });

  it('defaults auto-accept threshold', () => {
    expect(autoAcceptThresholdFromSettings(undefined)).toBe(DEFAULT_AUTO_ACCEPT_THRESHOLD);
    expect(autoAcceptThresholdFromSettings({ autoAcceptThreshold: 0.5 })).toBe(0.5);
  });

  it('defaults and clamps curate reject-below', () => {
    expect(curateRejectBelowFromSettings(undefined)).toBe(DEFAULT_CURATE_REJECT_BELOW);
    expect(curateRejectBelowFromSettings({ curateRejectBelow: 0.4 })).toBe(0.4);
    expect(curateRejectBelowFromSettings({ curateRejectBelow: 1.5 })).toBe(1);
    expect(curateRejectBelowFromSettings({ curateRejectBelow: -1 })).toBe(0);
  });
});
