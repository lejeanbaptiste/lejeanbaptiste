import { describe, expect, it } from 'vitest';
import { parseAchievementsPut } from '../src/achievementsProtocol';

describe('parseAchievementsPut', () => {
  it('accepts a valid body', () => {
    const result = parseAchievementsPut({ baseRevision: 2, blob: '{"v":2}' });
    expect(result).toEqual({ ok: true, value: { baseRevision: 2, blob: '{"v":2}' } });
  });

  it('rejects missing blob', () => {
    expect(parseAchievementsPut({ baseRevision: 0 })).toEqual({
      ok: false,
      error: '`blob` must be a non-empty string.',
    });
  });

  it('rejects negative baseRevision', () => {
    expect(parseAchievementsPut({ baseRevision: -1, blob: 'x' })).toEqual({
      ok: false,
      error: '`baseRevision` must be a non-negative integer.',
    });
  });
});
