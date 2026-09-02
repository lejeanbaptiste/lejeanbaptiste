import { ARCHIVE_BACKGROUND_ASSETS_BY_RANK } from './generatedBackgroundPools';
import { WEAPON_POOLS } from './generatedBodyPools';
import {
  eligiblePoseIndices,
  MODERN_ERA_RANK,
  pickWeapon,
  poseEligibleForRank,
  rankOfBackgroundKey,
  weaponFloorForBackground,
  weaponRankBoundsForBackground,
  weaponTierForBackgroundRank,
  stampSvgPixelSize,
  svgStampPixelsForCssBox,
  BODY_CSS_OVERSAMPLE,
  SVG_PIXEL_OVERSAMPLE,
  archiveTreatmentForBackground,
  scenePhotoFilterForBackground,
  scenePhotoFilterForPose,
} from './UniformAvatar';

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
    expect(poseEligibleForRank(7, 'm', 0)).toBe(true);
    expect(poseEligibleForRank(7, 'f', 0)).toBe(true);
    expect(poseEligibleForRank(7, 'm', 1)).toBe(true);
    expect(poseEligibleForRank(5, 'm', 0)).toBe(true);
    expect(poseEligibleForRank(6, 'f', 0)).toBe(true);
  });

  it('lists only eligible poses for rank 1 (Fusilier)', () => {
    expect(eligiblePoseIndices('m', 0)).toEqual([1, 5, 6, 8, 11]);
    expect(eligiblePoseIndices('f', 0)).toEqual([1, 5, 6, 8, 11]);
  });

  it('keeps the aircraft subject out of Rank 2 and introduces it in Rank 3', () => {
    expect(eligiblePoseIndices('m', 1)).toEqual([1, 2, 5, 6, 7, 8, 11]);
    expect(eligiblePoseIndices('m', 2)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 11, 9001]);
  });

  it('limits unranked players to body1 only', () => {
    // body5 requires its napoleonic-tier weapon art, which only unlocks at
    // Rank 1 (rankIndex 0) and above - see WEAPON_ERA_TIERS in
    // visual_design's bodySvg.mjs. An unranked player (-1) hasn't reached
    // that yet, so body5 correctly drops out here even though it's back in
    // the very next test ('lists only eligible poses for rank 1').
    expect(eligiblePoseIndices('m', -1)).toEqual([1]);
  });
});

describe('pickWeapon requireRank', () => {
  // Pose 5's weapon channel has tiers {1, 3, 4, 5} - a good spread for
  // asserting requireRank actually excludes the lower ones.
  it('cycles through every unlocked tier when unrestricted', () => {
    const seenRanks = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const weapon = pickWeapon(5, 'm', 6, null);
      seenRanks.add(weapon!.rank);
    }
    expect(Array.from(seenRanks).sort()).toEqual([1, 3, 4, 5]);
  });

  it('restricts to tiers at or above requireRank (Rank 5+ backdrop pairing)', () => {
    const seenRanks = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const weapon = pickWeapon(5, 'm', 6, null, 5);
      seenRanks.add(weapon!.rank);
    }
    expect(Array.from(seenRanks)).toEqual([5]);
  });

  // Why AchievementsDialog clamps its floor to MODERN_ERA_RANK instead of
  // passing the backdrop's own rank: Rank 6/7 backdrops exist, but no pose
  // has weapon art above tier 5, so a floor of 6 empties the pool and the
  // fallback below hands back a Napoleonic musket for a sci-fi scene. If
  // tier 6 art ever lands, this fails - bump MODERN_ERA_RANK to match.
  it('has no weapon art above MODERN_ERA_RANK', () => {
    const tiers = Object.values(WEAPON_POOLS).flatMap((channels) =>
      channels.flatMap((channel) => Object.keys(channel).map(Number)),
    );
    expect(Math.max(...tiers)).toBe(MODERN_ERA_RANK);
  });

  it('falls back to the unrestricted pool if requireRank would empty it', () => {
    // At rankIndex 1 (Rank 2), only tier 1 is unlocked - nothing meets a
    // requireRank of 5, so the pick should fall back rather than return null.
    const weapon = pickWeapon(5, 'm', 1, null, 5);
    expect(weapon?.rank).toBe(1);
  });

  it('locks to a single tier when floor and ceiling match (era backdrop pairing)', () => {
    const seenRanks = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const weapon = pickWeapon(5, 'm', 6, null, 3, 3);
      seenRanks.add(weapon!.rank);
    }
    expect(Array.from(seenRanks)).toEqual([3]);
  });

  it('falls back to the unrestricted pool if maxRank would empty it', () => {
    // Pose 5 has no tier-1-only art at rankIndex 6 when capped to tier 1 -
    // but tier 1 exists, so this should still work. Use maxRank 0 (impossible).
    const weapon = pickWeapon(5, 'm', 6, null, undefined, 0);
    expect(weapon?.rank).toBeGreaterThan(0);
  });
});

describe('weaponTierForBackgroundRank', () => {
  it('maps world ranks to weapon era tiers', () => {
    expect(weaponTierForBackgroundRank(1)).toBe(1);
    expect(weaponTierForBackgroundRank(2)).toBe(1);
    expect(weaponTierForBackgroundRank(3)).toBe(3);
    expect(weaponTierForBackgroundRank(4)).toBe(4);
    expect(weaponTierForBackgroundRank(5)).toBe(MODERN_ERA_RANK);
    expect(weaponTierForBackgroundRank(7)).toBe(MODERN_ERA_RANK);
  });
});

describe('weaponRankBoundsForBackground', () => {
  // Ranks 5, 6 and 7 all share tier-5 weapon art for now.
  it('floors every modern-era backdrop at MODERN_ERA_RANK', () => {
    for (const rank of [5, 6, 7]) {
      const backdrop = ARCHIVE_BACKGROUND_ASSETS_BY_RANK[rank - 1]!.find(
        (asset) => asset.rank === rank,
      );
      expect(backdrop).toBeDefined();
      expect(weaponRankBoundsForBackground(backdrop!.assetKey)).toEqual({
        floor: MODERN_ERA_RANK,
      });
    }
  });

  // A Rank 3 WWI scene gets tier-3 weapons only — not Napoleonic 1/2.
  it('maps each backdrop era to its weapon tier', () => {
    const rank1 = ARCHIVE_BACKGROUND_ASSETS_BY_RANK[0]!.find((asset) => asset.rank === 1)!;
    expect(weaponRankBoundsForBackground(rank1.assetKey)).toEqual({ ceiling: 1, floor: 1 });
    expect(weaponRankBoundsForBackground('bg/r02/military/r02-alps-road')).toEqual({
      ceiling: 1,
      floor: 1,
    });
    for (const rank of [3, 4]) {
      const backdrop = ARCHIVE_BACKGROUND_ASSETS_BY_RANK[rank - 1]!.find(
        (asset) => asset.rank === rank,
      );
      expect(backdrop).toBeDefined();
      expect(weaponRankBoundsForBackground(backdrop!.assetKey)).toEqual({
        ceiling: rank,
        floor: rank,
      });
    }
  });

  it('never asks pickWeapon for the nonexistent tier 2 on a Rank 2 backdrop', () => {
    const bounds = weaponRankBoundsForBackground('bg/r02/military/r02-alps-road');
    const seenRanks = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const weapon = pickWeapon(7, 'm', 6, null, bounds.floor, bounds.ceiling);
      seenRanks.add(weapon!.rank);
    }
    expect(Array.from(seenRanks)).toEqual([1]);
  });

  it('leaves an unrecognised key unrestricted', () => {
    expect(weaponRankBoundsForBackground('bg/does-not-exist')).toEqual({});
  });
});

describe('weaponFloorForBackground', () => {
  it('remains a floor-only view of weaponRankBoundsForBackground', () => {
    expect(weaponFloorForBackground('bg/does-not-exist')).toBeUndefined();
    expect(weaponFloorForBackground('bg/r03/military/r03-artillery')).toBe(3);
    expect(weaponFloorForBackground('bg/r05/military/r05-a-boarding')).toBe(MODERN_ERA_RANK);
  });
});

describe('rankOfBackgroundKey', () => {
  it('resolves a real archive asset to its declared rank', () => {
    expect(rankOfBackgroundKey('bg/r05/military/r05-a-boarding')).toBe(5);
    expect(rankOfBackgroundKey('bg/r01/military/r01-artillery')).toBe(1);
  });

  it('returns null for an unrecognised key', () => {
    expect(rankOfBackgroundKey('bg/does-not-exist')).toBeNull();
  });
});

describe('scene photo filter', () => {
  it('leaves subject-scene grading to the authored composite', () => {
    expect(scenePhotoFilterForPose(9001)).toBeUndefined();
    expect(scenePhotoFilterForPose(8)).toBeUndefined();
  });

  it('uses the selected archive record rather than the pose for grading', () => {
    expect(archiveTreatmentForBackground('bg/r03/military/r03-artillery')).toBe('wwi-ortho');
    expect(archiveTreatmentForBackground('bg/r04/military/r04-a-airfield')).toBe('wwii-bw');
    expect(archiveTreatmentForBackground('bg/r04/military/r04-a-hospital')).toBe('sepia');
    expect(archiveTreatmentForBackground('bg/r01/military/r01-artillery')).toBe('colour');
    expect(scenePhotoFilterForBackground('bg/r01/military/r01-artillery', 'p')).toBeUndefined();
  });

  it('references a grade the caller has to define, not a CSS approximation', () => {
    // The filter value is only half the contract - it names a <filter> by id
    // that the caller must render (see sceneGradeDefs). A treatment that
    // silently dropped the url() would fall back to no grade at all rather
    // than fail visibly, so pin it here.
    for (const key of [
      'bg/r03/military/r03-artillery',
      'bg/r04/military/r04-a-airfield',
      'bg/r04/military/r04-a-hospital',
    ]) {
      expect(scenePhotoFilterForBackground(key, 'p')).toBe('url(#p-grade)');
    }
  });
});

describe('stampSvgPixelSize', () => {
  it('replaces mm width/height with pixel sizes and keeps viewBox', () => {
    const input =
      '<svg width="200.55417mm" height="87.57708mm" viewBox="0 0 200.55417 87.57708" xmlns="http://www.w3.org/2000/svg"><g/></svg>';
    const stamped = stampSvgPixelSize(input, 586.5, 256);
    expect(stamped).toMatch(/^<svg width="587" height="256" viewBox="0 0 200.55417 87.57708"/);
    expect(stamped).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(stamped).not.toContain('mm');
  });

  it('handles single-quoted attributes', () => {
    const stamped = stampSvgPixelSize(
      "<svg width='10' height='10' viewBox='0 0 1 1'></svg>",
      20,
      40,
    );
    expect(stamped).toBe('<svg width="20" height="40" viewBox=\'0 0 1 1\'></svg>');
  });
});

describe('svgStampPixelsForCssBox', () => {
  it('multiplies the CSS box by SVG_PIXEL_OVERSAMPLE (and devicePixelRatio)', () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    expect(svgStampPixelsForCssBox(100, 50)).toEqual({
      width: 100 * SVG_PIXEL_OVERSAMPLE,
      height: 50 * SVG_PIXEL_OVERSAMPLE,
    });
    expect(BODY_CSS_OVERSAMPLE).toBe(2);
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: original });
  });
});
