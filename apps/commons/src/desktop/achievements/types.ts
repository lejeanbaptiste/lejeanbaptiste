export interface ProjectMetrics {
  /** Relative paths of documents stamped with the encoder's name on save. */
  savedDocs: string[];
  /** High-water marks; never decremented so deleting work keeps medals. */
  tagsTotal: number;
  disambiguated: number;
  placesDisambiguated: number;
  entities: number;
  /** Distinct xml:lang values seen in the entity database. */
  languages: number;
}

export interface AchievementsState {
  version: 1;
  /** First time the achievements file was created — service start date. */
  installedAt: string;
  saveCount: number;
  /** Times the Time Machine dialog has been opened (for Precautionary measures). */
  timeMachineRuns: number;
  /** Distinct local calendar days on which a leaderboard submission succeeded. */
  leaderboardPublicationDays: string[];
  unlocked: Record<string, { at: string }>;
  projects: Record<string, ProjectMetrics>;
  avatar: { kind: 'dicebear'; options: import('./dicebear').DiceBearAvatarOptions } | null;
}

/** Global metrics aggregated across projects. */
export interface GlobalMetrics {
  texts: number;
  tags: number;
  disambiguated: number;
  places: number;
  entities: number;
  published: number;
  languages: number;
}

export type MetricId = 'texts' | 'tags' | 'disambiguated' | 'places' | 'entities' | 'published';

export interface RankMedalDef {
  metric: MetricId;
  /** Medal (decoration) name, e.g. "Order of the Chevron". */
  medalName: string;
  description: string;
  /** One threshold per medal-bearing rank, Fusilier → Général de brigade. */
  thresholds: number[];
}

export interface SpecialAchievementDef {
  id: string;
  name: string;
  description: string;
  /** Hidden achievements are not listed until earned. */
  hidden?: boolean;
}

export interface UnlockedAchievement {
  id: string;
  name: string;
  description: string;
  at: string;
}
