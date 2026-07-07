import {
  addNamedProfile,
  createDefaultAiPromptProfile,
  createDefaultAiPromptProfilesState,
  DEFAULT_AUDIT_CLEAN_TASK_TEXT,
  DEFAULT_DISAMBIGUATION_RANK_TASK_TEXT,
  DEFAULT_SUGGEST_TASK_TEXT,
  parseAiPromptProfilesFile,
  promptVersionWithProfile,
  revertProfileToDefaults,
  saveProfileEdits,
  serializeAiPromptProfilesFile,
} from './aiPromptProfiles';
import { AUDIT_CLEAN_PROMPT_VERSION, buildSuggestPrompt, SUGGEST_PROMPT_VERSION } from './prompts';

describe('aiPromptProfiles', () => {
  it('round-trips profile storage', () => {
    const state = createDefaultAiPromptProfilesState();
    const parsed = parseAiPromptProfilesFile(serializeAiPromptProfilesFile(state));
    expect(parsed.activeProfileId).toBe('default');
    expect(parsed.profiles[0]?.label).toBe('Default');
  });

  it('bumps version when task text changes', () => {
    const state = createDefaultAiPromptProfilesState();
    const next = saveProfileEdits(state, 'default', {
      label: 'Default',
      suggestTaskText: 'Custom suggest task',
      auditCleanTaskText: DEFAULT_AUDIT_CLEAN_TASK_TEXT,
      disambiguationRankTaskText: DEFAULT_DISAMBIGUATION_RANK_TASK_TEXT,
    });
    expect(next.profiles[0]?.version).toBe(1);
  });

  it('appends profile suffix to cache key after save', () => {
    const profile = {
      ...createDefaultAiPromptProfile(),
      version: 2,
      suggestTaskText: 'Edited',
    };
    expect(promptVersionWithProfile(SUGGEST_PROMPT_VERSION, profile)).toBe(
      'suggest.v3+defaultv2',
    );
    expect(promptVersionWithProfile(AUDIT_CLEAN_PROMPT_VERSION, profile)).toBe(
      'audit-clean.v2+defaultv2',
    );
  });

  it('keeps shipped version for untouched default profile', () => {
    expect(promptVersionWithProfile(SUGGEST_PROMPT_VERSION, createDefaultAiPromptProfile())).toBe(
      'suggest.v3',
    );
  });

  it('revert restores shipped task bodies and bumps version', () => {
    const edited = {
      ...createDefaultAiPromptProfile(),
      version: 3,
      suggestTaskText: 'Edited',
      auditCleanTaskText: 'Also edited',
    };
    const reverted = revertProfileToDefaults(edited);
    expect(reverted.suggestTaskText).toBe(DEFAULT_SUGGEST_TASK_TEXT);
    expect(reverted.auditCleanTaskText).toBe(DEFAULT_AUDIT_CLEAN_TASK_TEXT);
    expect(reverted.disambiguationRankTaskText).toBe(DEFAULT_DISAMBIGUATION_RANK_TASK_TEXT);
    expect(reverted.version).toBe(4);
  });

  it('adds named profiles with a new id', () => {
    const state = createDefaultAiPromptProfilesState();
    const next = addNamedProfile(state, 'Groq biography', createDefaultAiPromptProfile());
    expect(next.profiles).toHaveLength(2);
    expect(next.activeProfileId).not.toBe('default');
    expect(next.profiles[1]?.label).toBe('Groq biography');
  });

  it('migrates profiles missing disambiguation task text', () => {
    const raw = JSON.stringify({
      version: 1,
      activeProfileId: 'default',
      profiles: [
        {
          id: 'default',
          label: 'Default',
          version: 0,
          suggestTaskText: DEFAULT_SUGGEST_TASK_TEXT,
          auditCleanTaskText: DEFAULT_AUDIT_CLEAN_TASK_TEXT,
        },
      ],
    });
    const parsed = parseAiPromptProfilesFile(raw);
    expect(parsed.profiles[0]?.disambiguationRankTaskText).toBe(DEFAULT_DISAMBIGUATION_RANK_TASK_TEXT);
  });
});

describe('prompt overrides', () => {
  it('uses custom suggest task text when provided', () => {
    const custom = 'Task: CUSTOM SUGGEST for {{TAGS}}.{{TAG_GUIDE}}';
    const { system } = buildSuggestPrompt({
      tags: ['persName'],
      chunkText: 'test',
      before: '',
      after: '',
      suggestTaskText: custom,
    });
    expect(system).toContain('CUSTOM SUGGEST');
    expect(system).not.toContain('SUGGEST. Find every mention');
  });
});
