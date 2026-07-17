import type { FileUsageCounts, TagUsageStats } from '../tagging/tagStats';
import {
  ANNOTATION_TAGS,
  DISAMBIGUATION_ATTRS,
  RANK_MEDALS,
  RANK_NAMES,
  RARE_ACHIEVEMENTS,
  RARE_UNLOCK_PROBABILITY,
  SPECIAL_ACHIEVEMENTS,
  rankMedalAchievementId,
} from './definitions';
import type { AchievementsState, GlobalMetrics, ProjectMetrics } from './types';

export const emptyProjectMetrics = (): ProjectMetrics => ({
  savedDocs: [],
  tagsTotal: 0,
  disambiguated: 0,
  placesDisambiguated: 0,
  entities: 0,
  languages: 0,
});

export const emptyState = (nowIso: string): AchievementsState => ({
  version: 1,
  installedAt: nowIso,
  saveCount: 0,
  unlocked: {},
  projects: {},
  avatar: null,
});

const sumDisambiguated = (attrs: TagUsageStats['project']['attrs']): number => {
  let total = 0;
  for (const [tagName, attrCounts] of Object.entries(attrs)) {
    if (!ANNOTATION_TAGS.has(tagName)) continue;
    // A tag with both @ref and @key would double-count; @ref dominates in
    // practice and inflation only ever accelerates medals, never blocks them.
    for (const attrName of DISAMBIGUATION_ATTRS) {
      total += attrCounts[attrName] ?? 0;
    }
  }
  return total;
};

/** Project-wide annotation metrics from the tag-stats sidecar. */
export const metricsFromTagStats = (
  stats: TagUsageStats,
): Pick<ProjectMetrics, 'tagsTotal' | 'disambiguated' | 'placesDisambiguated'> => {
  let tagsTotal = 0;
  for (const [tagName, count] of Object.entries(stats.project.tags)) {
    if (ANNOTATION_TAGS.has(tagName)) tagsTotal += count;
  }

  let placesDisambiguated = 0;
  for (const attrName of DISAMBIGUATION_ATTRS) {
    placesDisambiguated += stats.project.attrs['placeName']?.[attrName] ?? 0;
  }

  return {
    tagsTotal,
    disambiguated: sumDisambiguated(stats.project.attrs),
    placesDisambiguated,
  };
};

/** Count entity records (person/place/org/bibl) in an entities.xml payload. */
export const countEntitiesInXml = (xml: string): { entities: number; languages: number } => {
  const entities = (xml.match(/<(person|place|org|bibl)[\s>]/g) ?? []).length;
  const langs = new Set<string>();
  for (const match of xml.matchAll(/xml:lang="([^"]+)"/g)) {
    langs.add(match[1]!);
  }
  return { entities, languages: langs.size };
};

/** Latin words plus CJK characters, so classical Chinese counts fairly. */
export const approximateWordCount = (xml: string): number => {
  const text = xml.replace(/<[^>]*>/g, ' ');
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const words = (text.match(/[A-Za-zÀ-ɏ']+/g) ?? []).length;
  return cjk + words;
};

export const aggregateGlobalMetrics = (state: AchievementsState): GlobalMetrics => {
  const global: GlobalMetrics = {
    texts: 0,
    tags: 0,
    disambiguated: 0,
    places: 0,
    entities: 0,
    languages: 0,
  };
  for (const project of Object.values(state.projects)) {
    global.texts += project.savedDocs.length;
    global.tags += project.tagsTotal;
    global.disambiguated += project.disambiguated;
    global.places += project.placesDisambiguated;
    // A shared central database is visible from every project, so entity
    // counts take the max rather than a double-counting sum.
    global.entities = Math.max(global.entities, project.entities);
    global.languages = Math.max(global.languages, project.languages);
  }
  return global;
};

export interface SaveContext {
  savedAt: Date;
  encoderName: string;
  /** Counts for the file that was just saved. */
  fileCounts: FileUsageCounts | null;
  /** Raw XML of the saved document. */
  xml: string;
  /** Random roll in [0, 1) — injected for testability. */
  roll: number;
  /** Second roll used to pick which rare achievement unlocks. */
  pickRoll: number;
}

const metricValue = (global: GlobalMetrics, metric: string): number => {
  switch (metric) {
    case 'texts':
      return global.texts;
    case 'tags':
      return global.tags;
    case 'disambiguated':
      return global.disambiguated;
    case 'places':
      return global.places;
    case 'entities':
      return global.entities;
    default:
      return 0;
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Everything newly earned by this save. Pure: mutates nothing, rolls are
 * injected. Rank medals may unlock several at once (a veteran corpus meeting
 * the feature for the first time) — all are returned; the caller decides how
 * loudly to announce them.
 */
export const determineNewUnlocks = (
  state: AchievementsState,
  global: GlobalMetrics,
  context: SaveContext,
): string[] => {
  const earned: string[] = [];
  const has = (id: string) => Boolean(state.unlocked[id]) || earned.includes(id);

  for (const medal of RANK_MEDALS) {
    const value = metricValue(global, medal.metric);
    medal.thresholds.slice(0, RANK_NAMES.length).forEach((threshold, rankIndex) => {
      const id = rankMedalAchievementId(medal.metric, rankIndex);
      if (value >= threshold && !has(id)) earned.push(id);
    });
  }

  const hour = context.savedAt.getHours();
  if (hour >= 2 && hour < 5 && !has('chou-blanc')) earned.push('chou-blanc');

  if (/xml:lang="ja[-"]/.test(context.xml) && !has('aspiring-sinologist')) {
    earned.push('aspiring-sinologist');
  }

  if (/jean[\s-]?baptiste/i.test(context.encoderName) && !has('jean-baptiste-too')) {
    earned.push('jean-baptiste-too');
  }

  if (global.languages >= 5 && !has('polyglot-scholar')) earned.push('polyglot-scholar');

  if (
    !has('long-form-commitment') &&
    approximateWordCount(context.xml) >= 10000 &&
    context.fileCounts &&
    Object.entries(context.fileCounts.tags).reduce(
      (total, [tag, count]) => (ANNOTATION_TAGS.has(tag) ? total + count : total),
      0,
    ) >= 100
  ) {
    earned.push('long-form-commitment');
  }

  const serviceMs = context.savedAt.getTime() - new Date(state.installedAt).getTime();
  if (serviceMs >= 30 * DAY_MS && !has('long-service-bronze')) earned.push('long-service-bronze');
  if (serviceMs >= 365 * DAY_MS && !has('long-service-silver')) earned.push('long-service-silver');
  if (serviceMs >= 3 * 365 * DAY_MS && !has('long-service-gold')) earned.push('long-service-gold');

  if (context.roll < RARE_UNLOCK_PROBABILITY) {
    const remaining = RARE_ACHIEVEMENTS.filter((def) => !has(def.id));
    if (remaining.length > 0) {
      const pick = remaining[Math.floor(context.pickRoll * remaining.length)];
      if (pick) earned.push(pick.id);
    }
  }

  return earned;
};

/** Rank index (0-based into RANK_NAMES) currently held for a metric, or -1. */
export const currentRankIndex = (state: AchievementsState, metric: string): number => {
  const medal = RANK_MEDALS.find((entry) => entry.metric === metric);
  const highestRank = medal ? Math.min(RANK_NAMES.length, medal.thresholds.length) - 1 : -1;
  for (let index = highestRank; index >= 0; index -= 1) {
    if (state.unlocked[rankMedalAchievementId(metric, index)]) return index;
  }
  return -1;
};

/** Retired achievement ids may linger in old files; count only current ones. */
export const countUnlocked = (state: AchievementsState): number =>
  Object.keys(state.unlocked).filter(isKnownAchievementId).length;

export const isKnownAchievementId = (id: string): boolean =>
  SPECIAL_ACHIEVEMENTS.some((def) => def.id === id) ||
  RARE_ACHIEVEMENTS.some((def) => def.id === id) ||
  /^rank-[a-z]+-\d+$/.test(id);
