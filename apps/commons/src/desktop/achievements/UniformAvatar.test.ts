import { eligiblePoseIndices, poseEligibleForRank } from './UniformAvatar';

describe('pose rank eligibility', () => {
  it('keeps unarmed poses at every rank', () => {
    for (const pose of [1, 2, 3, 4]) {
      expect(poseEligibleForRank(pose, 'm', -1)).toBe(true);
      expect(poseEligibleForRank(pose, 'f', 6)).toBe(true);
    }
  });

  it('excludes weaponed poses until the player rank unlocks a tier', () => {
    expect(poseEligibleForRank(7, 'm', 0)).toBe(false);
    expect(poseEligibleForRank(7, 'f', 0)).toBe(false);
    expect(poseEligibleForRank(7, 'm', 1)).toBe(true);
    expect(poseEligibleForRank(5, 'm', 0)).toBe(true);
    expect(poseEligibleForRank(6, 'f', 0)).toBe(true);
  });

  it('lists only eligible poses for rank 1 (Fusilier)', () => {
    expect(eligiblePoseIndices('m', 0)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(eligiblePoseIndices('f', 0)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('includes body7 from rank 2 upward', () => {
    expect(eligiblePoseIndices('m', 1)).toContain(7);
    expect(eligiblePoseIndices('m', 0)).not.toContain(7);
  });
});
