import { emptyProjectMetrics, emptyState } from './evaluate';
import { createDefaultDiceBearAvatar } from './dicebear';
import type { AchievementsState, ProjectMetrics } from './types';

// Fallback only - used when a disk read transiently fails or returns
// unparsable content, never as a fast path. Achievements live in a file that
// can change on disk out from under this process (cloud-sync restore, Time
// Machine restore, a hand-edited backup), so every load must go back to
// disk; treating a stale in-memory copy as authoritative was what let a
// restored achievements.json get silently clobbered back to the old
// progress on the very next document save.
let lastKnownGoodState: AchievementsState | null = null;

const sanitizeProjectMetrics = (value: Partial<ProjectMetrics> | undefined): ProjectMetrics => ({
  savedDocs: Array.isArray(value?.savedDocs)
    ? value.savedDocs.filter((doc): doc is string => typeof doc === 'string')
    : [],
  tagsTotal: typeof value?.tagsTotal === 'number' ? value.tagsTotal : 0,
  disambiguated: typeof value?.disambiguated === 'number' ? value.disambiguated : 0,
  placesDisambiguated:
    typeof value?.placesDisambiguated === 'number' ? value.placesDisambiguated : 0,
  entities: typeof value?.entities === 'number' ? value.entities : 0,
  docLanguages: Array.isArray(value?.docLanguages)
    ? [...new Set(value.docLanguages.filter((lang): lang is string => typeof lang === 'string'))]
    : [],
});

const sanitizeState = (parsed: Partial<AchievementsState>): AchievementsState => {
  const state = emptyState(
    typeof parsed.installedAt === 'string' ? parsed.installedAt : new Date().toISOString(),
  );
  state.saveCount = typeof parsed.saveCount === 'number' ? parsed.saveCount : 0;
  state.timeMachineRuns =
    typeof parsed.timeMachineRuns === 'number' && parsed.timeMachineRuns >= 0
      ? Math.floor(parsed.timeMachineRuns)
      : 0;
  state.leaderboardPublicationDays = Array.isArray(parsed.leaderboardPublicationDays)
    ? [
        ...new Set(
          parsed.leaderboardPublicationDays.filter(
            (day): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day),
          ),
        ),
      ].sort()
    : [];
  state.sourceModeSaveCount =
    typeof parsed.sourceModeSaveCount === 'number' && parsed.sourceModeSaveCount >= 0
      ? Math.floor(parsed.sourceModeSaveCount)
      : 0;
  if (
    parsed.githubContributions &&
    typeof parsed.githubContributions.count === 'number' &&
    typeof parsed.githubContributions.fetchedAt === 'string'
  ) {
    state.githubContributions = {
      count: parsed.githubContributions.count,
      fetchedAt: parsed.githubContributions.fetchedAt,
    };
  }
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
          bodyType:
            options.bodyType === 'm' || options.bodyType === 'f'
              ? options.bodyType
              : defaults.bodyType,
          eyebrowsVariant:
            typeof options.eyebrowsVariant === 'string'
              ? options.eyebrowsVariant
              : defaults.eyebrowsVariant,
          eyesVariant:
            typeof options.eyesVariant === 'string' ? options.eyesVariant : defaults.eyesVariant,
          featuresVariant:
            typeof options.featuresVariant === 'string'
              ? options.featuresVariant
              : defaults.featuresVariant,
          featuresProbability:
            typeof options.featuresProbability === 'number'
              ? options.featuresProbability
              : defaults.featuresProbability,
          earringsVariant:
            typeof options.earringsVariant === 'string'
              ? options.earringsVariant
              : defaults.earringsVariant,
          earringsProbability:
            typeof options.earringsProbability === 'number'
              ? options.earringsProbability
              : defaults.earringsProbability,
        },
      };
    }
  }
  return state;
};

const unionStrings = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])].sort();

const mergeProjectMetrics = (a: ProjectMetrics, b: ProjectMetrics): ProjectMetrics => ({
  savedDocs: unionStrings(a.savedDocs, b.savedDocs),
  tagsTotal: Math.max(a.tagsTotal, b.tagsTotal),
  disambiguated: Math.max(a.disambiguated, b.disambiguated),
  placesDisambiguated: Math.max(a.placesDisambiguated, b.placesDisambiguated),
  entities: Math.max(a.entities, b.entities),
  docLanguages: unionStrings(a.docLanguages, b.docLanguages),
});

/**
 * Combines the state that's actually on disk right now with the state this
 * process has been mutating in memory, so two machines sharing a cloud
 * folder never lose progress to whichever one happens to save last. Every
 * field here is either a high-water mark, an append-only set, or otherwise
 * safe to take the "more advanced" side of - never a blind overwrite. Kept
 * as a pure function (not a class/singleton) so it can be exercised the
 * same way regardless of which side is fresher.
 */
export const mergeAchievementsStates = (
  diskState: AchievementsState,
  localState: AchievementsState,
): AchievementsState => {
  const projectKeys = new Set([
    ...Object.keys(diskState.projects),
    ...Object.keys(localState.projects),
  ]);
  const projects: Record<string, ProjectMetrics> = {};
  for (const key of projectKeys) {
    const diskMetrics = diskState.projects[key];
    const localMetrics = localState.projects[key];
    projects[key] =
      diskMetrics && localMetrics
        ? mergeProjectMetrics(diskMetrics, localMetrics)
        : (diskMetrics ?? localMetrics!);
  }

  const unlocked: AchievementsState['unlocked'] = { ...diskState.unlocked };
  for (const [id, entry] of Object.entries(localState.unlocked)) {
    const existing = unlocked[id];
    // Keep whichever timestamp is earlier - that's the true first-unlock time.
    if (!existing || entry.at.localeCompare(existing.at) < 0) unlocked[id] = entry;
  }

  const githubContributions =
    diskState.githubContributions && localState.githubContributions
      ? diskState.githubContributions.fetchedAt.localeCompare(
          localState.githubContributions.fetchedAt,
        ) >= 0
        ? diskState.githubContributions
        : localState.githubContributions
      : (diskState.githubContributions ?? localState.githubContributions);

  return {
    version: 1,
    installedAt:
      diskState.installedAt.localeCompare(localState.installedAt) <= 0
        ? diskState.installedAt
        : localState.installedAt,
    saveCount: Math.max(diskState.saveCount, localState.saveCount),
    timeMachineRuns: Math.max(diskState.timeMachineRuns, localState.timeMachineRuns),
    leaderboardPublicationDays: unionStrings(
      diskState.leaderboardPublicationDays,
      localState.leaderboardPublicationDays,
    ),
    sourceModeSaveCount: Math.max(diskState.sourceModeSaveCount, localState.sourceModeSaveCount),
    githubContributions,
    unlocked,
    projects,
    // Decorative and unversioned - prefer whichever side actually customized
    // it over a side that never touched avatar settings this session.
    avatar: localState.avatar ?? diskState.avatar,
  };
};

export const loadAchievementsState = async (): Promise<AchievementsState> => {
  let raw: string | null;
  try {
    raw = (await window.electronAPI?.readAchievementsFile?.()) ?? null;
  } catch {
    raw = null;
  }

  if (raw) {
    try {
      const state = sanitizeState(JSON.parse(raw) as Partial<AchievementsState>);
      lastKnownGoodState = state;
      return state;
    } catch {
      // Corrupt file: fall through to the last-known-good/empty fallback
      // below rather than crash the save pipeline.
    }
  }

  if (lastKnownGoodState) return lastKnownGoodState;

  lastKnownGoodState = emptyState(new Date().toISOString());
  return lastKnownGoodState;
};

export const saveAchievementsState = async (state: AchievementsState): Promise<void> => {
  try {
    let raw: string | null = null;
    try {
      raw = (await window.electronAPI?.readAchievementsFile?.()) ?? null;
    } catch {
      raw = null;
    }
    let merged = state;
    if (raw) {
      try {
        const onDisk = sanitizeState(JSON.parse(raw) as Partial<AchievementsState>);
        merged = mergeAchievementsStates(onDisk, state);
      } catch {
        // Corrupt on-disk file: nothing sound to merge with, write local as-is.
      }
    }
    lastKnownGoodState = merged;
    await window.electronAPI?.writeAchievementsFile?.(JSON.stringify(merged, null, 2));
  } catch {
    // Achievements are decorative; never let them break a save.
  }
};

export const getProjectMetrics = (state: AchievementsState, projectKey: string): ProjectMetrics => {
  if (!state.projects[projectKey]) state.projects[projectKey] = emptyProjectMetrics();
  return state.projects[projectKey]!;
};

export const clearAchievementsCache = () => {
  lastKnownGoodState = null;
};
