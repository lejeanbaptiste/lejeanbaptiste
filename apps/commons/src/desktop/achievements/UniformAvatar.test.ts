import { eligiblePoseIndices, poseEligibleForRank } from './UniformAvatar';

describe('pose rank eligibility', () => {
  it('keeps early unarmed poses at every rank', () => {
    for (const pose of [1, 2]) {
      expect(poseEligibleForRank(pose, 'm', -1)).toBe(true);
      expect(poseEligibleForRank(pose, 'f', 6)).toBe(true);
    }
  });

  it('unlocks body3 and body4 at rank 3 (Caporal) and above', () => {
    expect(poseEligibleForRank(3, 'm', 1)).toBe(false);
    expect(poseEligibleForRank(4, 'f', 1)).toBe(false);
    expect(poseEligibleForRank(3, 'm', 2)).toBe(true);
    expect(poseEligibleForRank(4, 'f', 2)).toBe(true);
  });

  it('excludes weaponed poses until the player rank unlocks a tier', () => {
    expect(poseEligibleForRank(7, 'm', 0)).toBe(false);
    expect(poseEligibleForRank(7, 'f', 0)).toBe(false);
    expect(poseEligibleForRank(7, 'm', 1)).toBe(true);
    expect(poseEligibleForRank(5, 'm', 0)).toBe(true);
    expect(poseEligibleForRank(6, 'f', 0)).toBe(true);
  });

  it('lists only eligible poses for rank 1 (Fusilier)', () => {
    expect(eligiblePoseIndices('m', 0)).toEqual([1, 2, 5, 6]);
    expect(eligiblePoseIndices('f', 0)).toEqual([1, 2, 5, 6]);
  });

  it('includes body7 from rank 2 upward but not body3/4 until rank 3', () => {
    expect(eligiblePoseIndices('m', 1)).toEqual([1, 2, 5, 6, 7]);
    expect(eligiblePoseIndices('m', 2)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('limits unranked players to body1 and body2', () => {
    expect(eligiblePoseIndices('m', -1)).toEqual([1, 2]);
  });
});
