import { normalizePathKey } from '../infrastructurePaths';
import type { TagUsageStats } from '../tagging/tagStats';
import { findAchievementDef } from './definitions';
import {
  aggregateGlobalMetrics,
  countEntitiesInXml,
  determineNewUnlocks,
  metricsFromTagStats,
} from './evaluate';
import { getProjectMetrics, loadAchievementsState, saveAchievementsState } from './store';

export type AchievementUnlockNotifier = (message: string) => void;

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
  filePath: string;
  xml: string;
  stats: TagUsageStats;
  notify: AchievementUnlockNotifier;
}): Promise<void> => {
  try {
    const { rootPath, filePath, xml, stats, notify } = options;
    const state = await loadAchievementsState();
    const savedAt = new Date();

    state.saveCount += 1;

    const projectKey = normalizePathKey(rootPath);
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
      roll: Math.random(),
      pickRoll: Math.random(),
    });

    const at = savedAt.toISOString();
    for (const id of newUnlocks) {
      state.unlocked[id] = { at };
    }

    await saveAchievementsState(state);

    if (newUnlocks.length > 3) {
      // A veteran corpus meeting the medals for the first time: one summary
      // instead of a snackbar barrage.
      notify(`🎖️ ${newUnlocks.length} achievements unlocked — see your Service Record`);
    } else {
      for (const id of newUnlocks) {
        const def = findAchievementDef(id);
        if (def) notify(`🎖️ Achievement unlocked: ${def.name} — ${def.description}`);
      }
    }
  } catch {
    // Decorative feature: swallow everything.
  }
};
