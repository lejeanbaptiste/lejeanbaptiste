import { mergeAchievementsPlaintext } from './achievementsMerge';

describe('mergeAchievementsPlaintext', () => {
  const base = {
    version: 1,
    installedAt: '2026-01-01T00:00:00.000Z',
    saveCount: 1,
    timeMachineRuns: 0,
    leaderboardPublicationDays: [],
    sourceModeSaveCount: 0,
    githubContributions: null,
    unlocked: {},
    projects: {},
    avatar: null,
  };

  it('keeps the higher saveCount', () => {
    const a = JSON.stringify({ ...base, saveCount: 3 });
    const b = JSON.stringify({ ...base, saveCount: 7 });
    const merged = JSON.parse(mergeAchievementsPlaintext(a, b)) as { saveCount: number };
    expect(merged.saveCount).toBe(7);
  });

  it('keeps the earlier unlock timestamp', () => {
    const a = JSON.stringify({
      ...base,
      unlocked: { medal: { at: '2026-02-01T00:00:00.000Z' } },
    });
    const b = JSON.stringify({
      ...base,
      unlocked: { medal: { at: '2026-01-15T00:00:00.000Z' } },
    });
    const merged = JSON.parse(mergeAchievementsPlaintext(a, b)) as {
      unlocked: Record<string, { at: string }>;
    };
    expect(merged.unlocked.medal?.at).toBe('2026-01-15T00:00:00.000Z');
  });
});
