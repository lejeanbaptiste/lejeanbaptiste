import {
  RANK_MEDALS,
  RARE_ACHIEVEMENTS,
  RARE_UNLOCK_PROBABILITY,
  TOTAL_ACHIEVEMENTS,
  rankMedalAchievementId,
} from './definitions';
import {
  aggregateGlobalMetrics,
  approximateWordCount,
  countEntitiesInXml,
  countUnlocked,
  determineNewUnlocks,
  emptyProjectMetrics,
  emptyState,
  metricsFromTagStats,
} from './evaluate';
import type { SaveContext } from './evaluate';
import type { TagUsageStats } from '../tagging/tagStats';
import type { AchievementsState, GlobalMetrics } from './types';

const makeStats = (overrides?: Partial<TagUsageStats['project']>): TagUsageStats => ({
  version: 1,
  project: {
    tags: { persName: 12, placeName: 3, p: 40, div: 8, ...overrides?.tags },
    attrs: {
      persName: { ref: 5, key: 2 },
      placeName: { ref: 1 },
      p: { rend: 40 },
      ...overrides?.attrs,
    },
    attrValues: overrides?.attrValues ?? {},
  },
  files: {},
});

const baseContext = (overrides?: Partial<SaveContext>): SaveContext => ({
  savedAt: new Date('2026-07-17T14:00:00'),
  encoderName: 'Daniel',
  fileCounts: null,
  xml: '<TEI/>',
  roll: 0.999,
  pickRoll: 0,
  ...overrides,
});

const zeroMetrics = (): GlobalMetrics => ({
  texts: 0,
  tags: 0,
  disambiguated: 0,
  places: 0,
  entities: 0,
  languages: 0,
});

describe('metricsFromTagStats', () => {
  it('counts only annotation tags, not structural markup', () => {
    const metrics = metricsFromTagStats(makeStats());
    expect(metrics.tagsTotal).toBe(15); // persName 12 + placeName 3; p and div ignored
  });

  it('counts @ref and @key as disambiguation, on annotation tags only', () => {
    const metrics = metricsFromTagStats(makeStats());
    expect(metrics.disambiguated).toBe(8); // persName 5+2, placeName 1; p@rend ignored
    expect(metrics.placesDisambiguated).toBe(1);
  });
});

describe('countEntitiesInXml', () => {
  it('counts entity records and distinct languages', () => {
    const xml = `<TEI><standOff>
      <listPerson><person xml:id="p1"><persName xml:lang="zh-Hant">A</persName><persName xml:lang="zh-Latn">B</persName></person><person xml:id="p2"/></listPerson>
      <listPlace><place xml:id="pl1"/></listPlace>
      <listBibl><bibl xml:id="w1"/></listBibl>
    </standOff></TEI>`;
    expect(countEntitiesInXml(xml)).toEqual({ entities: 4, languages: 2 });
  });
});

describe('approximateWordCount', () => {
  it('counts CJK characters and Latin words', () => {
    expect(approximateWordCount('<p>天命之謂性 the doctrine of the mean</p>')).toBe(10);
  });
});

describe('aggregateGlobalMetrics', () => {
  it('sums annotation work but takes the max of shared entity counts', () => {
    const state = emptyState('2026-01-01T00:00:00.000Z');
    state.projects['a'] = { ...emptyProjectMetrics(), tagsTotal: 10, entities: 300 };
    state.projects['b'] = { ...emptyProjectMetrics(), tagsTotal: 5, entities: 300 };
    const global = aggregateGlobalMetrics(state);
    expect(global.tags).toBe(15);
    expect(global.entities).toBe(300);
  });
});

describe('determineNewUnlocks', () => {
  const freshState = (): AchievementsState => emptyState('2026-07-01T00:00:00.000Z');

  it('awards every rank crossed by the current value', () => {
    const global = { ...zeroMetrics(), tags: 5100 };
    const earned = determineNewUnlocks(freshState(), global, baseContext());
    expect(earned).toContain(rankMedalAchievementId('tags', 0));
    expect(earned).toContain(rankMedalAchievementId('tags', 2)); // threshold 5000
    expect(earned).not.toContain(rankMedalAchievementId('tags', 3)); // threshold 20000
  });

  it('does not re-award ranks already held', () => {
    const state = freshState();
    state.unlocked[rankMedalAchievementId('tags', 0)] = { at: '2026-07-01T00:00:00.000Z' };
    const global = { ...zeroMetrics(), tags: 150 };
    expect(determineNewUnlocks(state, global, baseContext())).toEqual([]);
  });

  it('awards Chou blanc for saves between 2 and 5 in the morning', () => {
    const at3am = baseContext({ savedAt: new Date('2026-07-17T03:12:00') });
    expect(determineNewUnlocks(freshState(), zeroMetrics(), at3am)).toContain('chou-blanc');
    const atNoon = baseContext({ savedAt: new Date('2026-07-17T12:00:00') });
    expect(determineNewUnlocks(freshState(), zeroMetrics(), atNoon)).not.toContain('chou-blanc');
  });

  it('recognizes Jean-Baptiste in any spelling', () => {
    for (const name of ['Jean-Baptiste', 'jean baptiste', 'JEANBAPTISTE Dupont']) {
      const earned = determineNewUnlocks(
        freshState(),
        zeroMetrics(),
        baseContext({ encoderName: name }),
      );
      expect(earned).toContain('jean-baptiste-too');
    }
  });

  it('awards Aspiring Sinologist for Japanese documents', () => {
    const context = baseContext({ xml: '<TEI><text xml:lang="ja">…</text></TEI>' });
    expect(determineNewUnlocks(freshState(), zeroMetrics(), context)).toContain(
      'aspiring-sinologist',
    );
  });

  it('rolls a rare achievement only under the probability threshold', () => {
    const win = baseContext({ roll: RARE_UNLOCK_PROBABILITY / 2, pickRoll: 0 });
    const earnedWin = determineNewUnlocks(freshState(), zeroMetrics(), win);
    expect(earnedWin).toContain(RARE_ACHIEVEMENTS[0]!.id);

    const lose = baseContext({ roll: RARE_UNLOCK_PROBABILITY * 2 });
    const earnedLose = determineNewUnlocks(freshState(), zeroMetrics(), lose);
    for (const rare of RARE_ACHIEVEMENTS) {
      expect(earnedLose).not.toContain(rare.id);
    }
  });

  it('picks rares only from those not yet earned', () => {
    const state = freshState();
    state.unlocked[RARE_ACHIEVEMENTS[0]!.id] = { at: '2026-07-01T00:00:00.000Z' };
    const win = baseContext({ roll: 0, pickRoll: 0 });
    const earned = determineNewUnlocks(state, zeroMetrics(), win);
    expect(earned).toContain(RARE_ACHIEVEMENTS[1]!.id);
    expect(earned).not.toContain(RARE_ACHIEVEMENTS[0]!.id);
  });

  it('awards long-service medals from the install date', () => {
    const state = emptyState('2023-01-01T00:00:00.000Z');
    const earned = determineNewUnlocks(state, zeroMetrics(), baseContext());
    expect(earned).toEqual(
      expect.arrayContaining(['long-service-bronze', 'long-service-silver', 'long-service-gold']),
    );
  });
});

describe('catalogue', () => {
  it('advertises the full achievement count', () => {
    // Medal lengths vary by metric; the catalogue includes every configured threshold.
    const rankCount = RANK_MEDALS.reduce((total, medal) => total + medal.thresholds.length, 0);
    expect(TOTAL_ACHIEVEMENTS).toBe(rankCount + 9 + 11);
  });

  it('ignores retired achievement ids left in old files when counting', () => {
    const state = emptyState('2026-07-01T00:00:00.000Z');
    state.unlocked['first-persname'] = { at: '2026-07-01T00:00:00.000Z' }; // retired
    state.unlocked['chou-blanc'] = { at: '2026-07-01T00:00:00.000Z' };
    expect(countUnlocked(state)).toBe(1);
  });
});
