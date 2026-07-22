import { normalizePathKey } from '../infrastructurePaths';
import type { TagUsageStats } from '../tagging/tagStats';
import { findAchievementDef } from './definitions';
import {
  aggregateGlobalMetrics,
  countEntitiesInXml,
  determineNewRankUnlocks,
  determineNewUnlocks,
  metricsFromTagStats,
} from './evaluate';
import { getProjectMetrics, loadAchievementsState, saveAchievementsState } from './store';
import type { AchievementsState } from './types';

export type AchievementUnlockNotifier = (message: string) => void;

const notifyUnlocks = (ids: string[], notify: AchievementUnlockNotifier) => {
  if (ids.length > 3) {
    notify(`🎖️ ${ids.length} achievements unlocked — see your Service Record`);
    return;
  }
  for (const id of ids) {
    const def = findAchievementDef(id);
    if (def) notify(`🎖️ Achievement unlocked: ${def.name} — ${def.description}`);
  }
};

const applyUnlocks = (state: AchievementsState, ids: string[], at: string): string[] => {
  const applied = ids.filter((id) => !state.unlocked[id]);
  for (const id of applied) state.unlocked[id] = { at };
  return applied;
};

/** Unlock a one-off achievement from an event outside the document-save path. */
export const unlockAchievement = async (
  id: string,
  notify: AchievementUnlockNotifier,
): Promise<AchievementsState> => {
  const state = await loadAchievementsState();
  const applied = applyUnlocks(state, [id], new Date().toISOString());
  if (applied.length > 0) {
    await saveAchievementsState(state);
    notifyUnlocks(applied, notify);
  }
  return state;
};

export const localCalendarDay = (date: Date): string => {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Record one successful leaderboard publication per local calendar day. */
export const recordLeaderboardPublication = async (
  publishedAt: Date,
  notify: AchievementUnlockNotifier,
): Promise<AchievementsState> => {
  const state = await loadAchievementsState();
  const day = localCalendarDay(publishedAt);
  if (state.leaderboardPublicationDays.includes(day)) return state;

  state.leaderboardPublicationDays.push(day);
  state.leaderboardPublicationDays.sort();
  const applied = applyUnlocks(
    state,
    determineNewRankUnlocks(state, aggregateGlobalMetrics(state)),
    publishedAt.toISOString(),
  );
  await saveAchievementsState(state);
  notifyUnlocks(applied, notify);
  return state;
};

const toRelativePath = (rootPath: string, filePath: string): string => {
  const normalizedRoot = normalizePathKey(rootPath).replace(/\/+$/, '');
  const normalizedFile = normalizePathKey(filePath);
  return normalizedFile.startsWith(`${normalizedRoot}/`)
    ? normalizedFile.slice(normalizedRoot.length + 1)
    : normalizedFile;
};

/** entities.xml at project root (project store) or central DB folder. */
const readEntityDatabaseXml = async (rootPath: string): Promise<string | null> => {
  const api = window.electronAPI;
  if (!api) return null;

  const candidates: string[] = [`${rootPath.replace(/[/\\]+$/, '')}/entities.xml`];
  try {
    const central = await api.getEntityDbFolder();
    if (central) candidates.push(`${central.replace(/[/\\]+$/, '')}/entities.xml`);
  } catch {
    // No central folder configured.
  }

  for (const candidate of candidates) {
    try {
      return await api.readFile(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
};

/**
 * Fire-and-forget achievements pass, called after a successful document
 * save. Must never throw into the save pipeline.
 */
export const processSaveForAchievements = async (options: {
  rootPath: string;
  /**
   * Stable per-project id from jean-baptiste.project.json (see
   * ProjectFileConfig.projectId). Falls back to the normalized root path
   * for callers that predate this field, but that fallback re-splits a
   * project's stats if it's later opened from a different absolute path
   * (e.g. a second machine) - always prefer passing the real id.
   */
  projectId?: string;
  filePath: string;
  xml: string;
  stats: TagUsageStats;
  sourceMode: boolean;
  notify: AchievementUnlockNotifier;
}): Promise<void> => {
  try {
    const { rootPath, projectId, filePath, xml, stats, sourceMode, notify } = options;
    const state = await loadAchievementsState();
    const savedAt = new Date();

    state.saveCount += 1;

    const projectKey = projectId ?? normalizePathKey(rootPath);
    const project = getProjectMetrics(state, projectKey);

    const relativePath = toRelativePath(rootPath, filePath);
    if (!project.savedDocs.includes(relativePath)) project.savedDocs.push(relativePath);

    const tagMetrics = metricsFromTagStats(stats);
    project.tagsTotal = Math.max(project.tagsTotal, tagMetrics.tagsTotal);
    project.disambiguated = Math.max(project.disambiguated, tagMetrics.disambiguated);
    project.placesDisambiguated = Math.max(
      project.placesDisambiguated,
      tagMetrics.placesDisambiguated,
    );

    const entityXml = await readEntityDatabaseXml(rootPath);
    if (entityXml) {
      const counted = countEntitiesInXml(entityXml);
      project.entities = Math.max(project.entities, counted.entities);
      project.languages = Math.max(project.languages, counted.languages);
    }

    let encoderName = '';
    try {
      encoderName = (await window.electronAPI?.getEncoderName()) ?? '';
    } catch {
      encoderName = '';
    }

    const global = aggregateGlobalMetrics(state);
    const newUnlocks = determineNewUnlocks(state, global, {
      savedAt,
      encoderName,
      fileCounts: stats.files[relativePath] ?? null,
      xml,
      sourceMode,
      roll: Math.random(),
      pickRoll: Math.random(),
    });

    const applied = applyUnlocks(state, newUnlocks, savedAt.toISOString());

    await saveAchievementsState(state);
    notifyUnlocks(applied, notify);
  } catch {
    // Decorative feature: swallow everything.
  }
};
