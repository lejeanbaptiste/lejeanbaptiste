import { emptyProjectMetrics, emptyState } from './evaluate';
import { createDefaultDiceBearAvatar } from './dicebear';
import type { AchievementsState, ProjectMetrics } from './types';

let cachedState: AchievementsState | null = null;

const sanitizeProjectMetrics = (value: Partial<ProjectMetrics> | undefined): ProjectMetrics => ({
  savedDocs: Array.isArray(value?.savedDocs)
    ? value.savedDocs.filter((doc): doc is string => typeof doc === 'string')
    : [],
  tagsTotal: typeof value?.tagsTotal === 'number' ? value.tagsTotal : 0,
  disambiguated: typeof value?.disambiguated === 'number' ? value.disambiguated : 0,
  placesDisambiguated:
    typeof value?.placesDisambiguated === 'number' ? value.placesDisambiguated : 0,
  entities: typeof value?.entities === 'number' ? value.entities : 0,
  languages: typeof value?.languages === 'number' ? value.languages : 0,
});

const sanitizeState = (parsed: Partial<AchievementsState>): AchievementsState => {
  const state = emptyState(
    typeof parsed.installedAt === 'string' ? parsed.installedAt : new Date().toISOString(),
  );
  state.saveCount = typeof parsed.saveCount === 'number' ? parsed.saveCount : 0;
  if (parsed.unlocked && typeof parsed.unlocked === 'object') {
    for (const [id, entry] of Object.entries(parsed.unlocked)) {
      if (entry && typeof entry.at === 'string') state.unlocked[id] = { at: entry.at };
    }
  }
  if (parsed.projects && typeof parsed.projects === 'object') {
    for (const [key, metrics] of Object.entries(parsed.projects)) {
      state.projects[key] = sanitizeProjectMetrics(metrics);
    }
  }
  if (parsed.avatar?.kind === 'dicebear' && parsed.avatar.options) {
    const options = parsed.avatar.options;
    if (
      typeof options.seed === 'string' &&
      typeof options.mouthVariant === 'string' &&
      typeof options.glassesVariant === 'string' &&
      typeof options.glassesProbability === 'number' &&
      typeof options.hairVariant === 'string' &&
      typeof options.skinColor === 'string' &&
      typeof options.hairColor === 'string'
    ) {
      const defaults = createDefaultDiceBearAvatar(options.seed);
      state.avatar = {
        kind: 'dicebear',
        options: {
          ...defaults,
          ...options,
          eyebrowsVariant:
            typeof options.eyebrowsVariant === 'string'
              ? options.eyebrowsVariant
              : defaults.eyebrowsVariant,
          eyesVariant:
            typeof options.eyesVariant === 'string' ? options.eyesVariant : defaults.eyesVariant,
        },
      };
    }
  }
  return state;
};

export const loadAchievementsState = async (): Promise<AchievementsState> => {
  if (cachedState) return cachedState;

  let raw: string | null = null;
  try {
    raw = (await window.electronAPI?.readAchievementsFile?.()) ?? null;
  } catch {
    raw = null;
  }

  if (raw) {
    try {
      cachedState = sanitizeState(JSON.parse(raw) as Partial<AchievementsState>);
      return cachedState;
    } catch {
      // Corrupt file: start over rather than crash the save pipeline.
    }
  }

  cachedState = emptyState(new Date().toISOString());
  return cachedState;
};

export const saveAchievementsState = async (state: AchievementsState): Promise<void> => {
  cachedState = state;
  try {
    await window.electronAPI?.writeAchievementsFile?.(JSON.stringify(state, null, 2));
  } catch {
    // Achievements are decorative; never let them break a save.
  }
};

export const getProjectMetrics = (state: AchievementsState, projectKey: string): ProjectMetrics => {
  if (!state.projects[projectKey]) state.projects[projectKey] = emptyProjectMetrics();
  return state.projects[projectKey]!;
};

export const clearAchievementsCache = () => {
  cachedState = null;
};
