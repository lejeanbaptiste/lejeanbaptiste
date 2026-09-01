/**
 * Pure merge for achievements plaintext JSON — mirrors
 * apps/commons/src/desktop/achievements/store.ts `mergeAchievementsStates` so
 * blob sync and cloud-folder saves stay consistent.
 */

interface ProjectMetrics {
  savedDocs: string[];
  tagsTotal: number;
  disambiguated: number;
  placesDisambiguated: number;
  entities: number;
  docLanguages: string[];
}

interface AchievementsState {
  version: 1;
  installedAt: string;
  saveCount: number;
  timeMachineRuns: number;
  leaderboardPublicationDays: string[];
  sourceModeSaveCount: number;
  githubContributions: { count: number; fetchedAt: string } | null;
  unlocked: Record<string, { at: string }>;
  projects: Record<string, ProjectMetrics>;
  avatar: unknown;
}

const unionStrings = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])].sort();

const mergeProjectMetrics = (a: ProjectMetrics, b: ProjectMetrics): ProjectMetrics => ({
  savedDocs: unionStrings(a.savedDocs, b.savedDocs),
  tagsTotal: Math.max(a.tagsTotal, b.tagsTotal),
  disambiguated: Math.max(a.disambiguated, b.disambiguated),
  placesDisambiguated: Math.max(a.placesDisambiguated, b.placesDisambiguated),
  entities: Math.max(a.entities, b.entities),
  docLanguages: unionStrings(a.docLanguages, b.docLanguages),
});

const parseState = (json: string): AchievementsState | null => {
  try {
    return JSON.parse(json) as AchievementsState;
  } catch {
    return null;
  }
};

/** Merge two decrypted achievements JSON strings; returns merged plaintext JSON. */
export const mergeAchievementsPlaintext = (aJson: string, bJson: string): string => {
  const diskState = parseState(aJson);
  const localState = parseState(bJson);
  if (!diskState) return bJson;
  if (!localState) return aJson;

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

  const merged: AchievementsState = {
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
    avatar: localState.avatar ?? diskState.avatar,
  };

  return JSON.stringify(merged, null, 2);
};
