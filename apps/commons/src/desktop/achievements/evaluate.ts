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
  docLanguages: [],
});

export const emptyState = (nowIso: string): AchievementsState => ({
  version: 1,
  installedAt: nowIso,
  saveCount: 0,
  timeMachineRuns: 0,
  leaderboardPublicationDays: [],
  sourceModeSaveCount: 0,
  githubContributions: null,
  unlocked: {},
  projects: {},
  avatar: null,
});

/** Empty annotation tags that earn The Empty Honour (not bare `<lb/>` etc.). */
export const EMPTY_HONOUR_TAGS = [
  'persName',
  'placeName',
  'date',
  'roleName',
  'orgName',
  'org',
] as const;

export const PRECAUTIONARY_MEASURES_THRESHOLD = 10;

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
export const countEntitiesInXml = (xml: string): { entities: number } => {
  const entities = (xml.match(/<(person|place|org|bibl)[\s>]/g) ?? []).length;
  return { entities };
};

/**
 * The document's own declared language, from its root element's xml:lang
 * (e.g. `<TEI xml:lang="fr">`, or `<translation xml:lang="ja">` for a
 * translation companion file) - anchored to the start of the document so an
 * unrelated `<foreign xml:lang="...">` span deep in the body never counts as
 * "this document is in that language" (Order of Babel is about which
 * languages you've saved *files* in, not which languages appear anywhere in
 * one file). Returns null when the root element declares no language.
 */
export const documentRootLanguage = (xml: string): string | null => {
  const match = /^\s*(?:<\?[^>]*?\?>\s*)*<[^>?!][^>]*?\bxml:lang="([^"]+)"/.exec(xml);
  return match ? match[1]! : null;
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
    published: state.leaderboardPublicationDays.length,
    wetWork: state.sourceModeSaveCount ?? 0,
    flagOfCommitment: state.githubContributions?.count ?? 0,
    languages: 0,
  };
  const allLanguages = new Set<string>();
  for (const project of Object.values(state.projects)) {
    global.texts += project.savedDocs.length;
    global.tags += project.tagsTotal;
    global.disambiguated += project.disambiguated;
    global.places += project.placesDisambiguated;
    // A shared central database is visible from every project, so entity
    // counts take the max rather than a double-counting sum.
    global.entities = Math.max(global.entities, project.entities);
    for (const lang of project.docLanguages) allLanguages.add(lang);
  }
  global.languages = allLanguages.size;
  return global;
};

export interface SaveContext {
  savedAt: Date;
  encoderName: string;
  /** Counts for the file that was just saved. */
  fileCounts: FileUsageCounts | null;
  /** Raw XML of the saved document. */
  xml: string;
  /** The save originated from an edited Monaco Source-mode buffer. */
  sourceMode: boolean;
  /** Random roll in [0, 1) — injected for testability. */
  roll: number;
  /** Second roll used to pick which rare achievement unlocks. */
  pickRoll: number;
}

export const metricValue = (global: GlobalMetrics, metric: string): number => {
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
    case 'published':
      return global.published;
    case 'wetWork':
      return global.wetWork;
    case 'flagOfCommitment':
      return global.flagOfCommitment;
    default:
      return 0;
  }
};

/**
 * True when the document uses an empty persName / placeName / date / roleName /
 * org(Name) — self-closing or paired with only whitespace inside.
 */
export const hasEmptyElement = (xml: string): boolean => {
  const names = EMPTY_HONOUR_TAGS.join('|');
  const selfClosing = new RegExp(`<(?:${names})(?:\\s[^<>]*?)?\\s*/>`, 'i');
  if (selfClosing.test(xml)) return true;
  const emptyPair = new RegExp(
    `<(${names})(?:\\s[^<>]*?)?>\\s*</\\1\\s*>`,
    'i',
  );
  return emptyPair.test(xml);
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Everything newly earned by this save. Pure: mutates nothing, rolls are
 * injected. Rank medals may unlock several at once (a veteran corpus meeting
 * the feature for the first time) — all are returned; the caller decides how
 * loudly to announce them.
 */
export const determineNewRankUnlocks = (
  state: AchievementsState,
  global: GlobalMetrics,
): string[] => {
  const earned: string[] = [];
  for (const medal of RANK_MEDALS) {
    const value = metricValue(global, medal.metric);
    medal.thresholds.slice(0, RANK_NAMES.length).forEach((threshold, rankIndex) => {
      const id = rankMedalAchievementId(medal.metric, rankIndex);
      if (value >= threshold && !state.unlocked[id]) earned.push(id);
    });
  }
  return earned;
};

export const determineNewUnlocks = (
  state: AchievementsState,
  global: GlobalMetrics,
  context: SaveContext,
): string[] => {
  const earned = determineNewRankUnlocks(state, global);
  const has = (id: string) => Boolean(state.unlocked[id]) || earned.includes(id);

  const hour = context.savedAt.getHours();
  if (hour >= 2 && hour < 5 && !has('chou-blanc')) earned.push('chou-blanc');

  if (/xml:lang="ja[-"]/.test(context.xml) && !has('aspiring-sinologist')) {
    earned.push('aspiring-sinologist');
  }

  if (/jean[\s-]?baptiste/i.test(context.encoderName) && !has('jean-baptiste-too')) {
    earned.push('jean-baptiste-too');
  }

  if (global.languages >= 3 && !has('polyglot-scholar')) earned.push('polyglot-scholar');

  if (hasEmptyElement(context.xml) && !has('empty-honour')) earned.push('empty-honour');

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

/**
 * Metrics tied for the player's single highest class across all 8 ladders -
 * empty when nothing is ranked yet. Drives regiment assignment: the caller
 * picks one entry at random when there's more than one (see
 * AchievementsDialog.tsx's assignedRegiment).
 */
export const topRankedMetrics = (state: AchievementsState): string[] => {
  const ranked = RANK_MEDALS.map((medal) => ({
    metric: medal.metric as string,
    rankIndex: currentRankIndex(state, medal.metric),
  })).filter((entry) => entry.rankIndex >= 0);
  if (ranked.length === 0) return [];
  const maxRank = Math.max(...ranked.map((entry) => entry.rankIndex));
  return ranked.filter((entry) => entry.rankIndex === maxRank).map((entry) => entry.metric);
};

/** Retired achievement ids may linger in old files; count only current ones. */
export const countUnlocked = (state: AchievementsState): number =>
  Object.keys(state.unlocked).filter(isKnownAchievementId).length;

export const isKnownAchievementId = (id: string): boolean =>
  SPECIAL_ACHIEVEMENTS.some((def) => def.id === id) ||
  RARE_ACHIEVEMENTS.some((def) => def.id === id) ||
  /^rank-[a-zA-Z]+-\d+$/.test(id);
