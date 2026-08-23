import { eligiblePoseIndices, pickBackgroundKey, poseEligibleForRank } from './UniformAvatar';
import { ARCHIVE_BACKGROUND_ASSETS_BY_RANK } from './generatedBackgroundPools';

describe('Rank 1 Revolutionary world', () => {
  it.each(['m', 'f'] as const)(
    'allows exactly the approved Rank 1 body poses for a %s player',
    (bodyType) => {
      expect(eligiblePoseIndices(bodyType, 0)).toEqual([1, 5, 6, 8, 11]);
    },
  );

  it('treats a pose with an empty weapons group as unarmed', () => {
    expect(poseEligibleForRank(5, 'm', 0)).toBe(true);
    expect(poseEligibleForRank(5, 'f', 0)).toBe(true);
  });

  it('selects only Revolutionary military records and avoids an immediate repeat', () => {
    const revolutionaryKeys = ARCHIVE_BACKGROUND_ASSETS_BY_RANK[0]!.map((asset) => asset.assetKey);
    expect(revolutionaryKeys).toHaveLength(18);

    for (const previousKey of revolutionaryKeys) {
      const selected = pickBackgroundKey(0, previousKey);
      expect(revolutionaryKeys).toContain(selected);
      expect(selected).not.toBe(previousKey);
    }
  });
});
