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
  /** Saves made from an edited Monaco Source-mode buffer — the Wet work ladder. */
  sourceModeSaveCount: number;
  /** Cached count for the Flag of Commitment ladder (GitHub issues/PRs/commits) —
   * refreshed opportunistically since it requires a network call. */
  githubContributions: { count: number; fetchedAt: string } | null;
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
  wetWork: number;
  flagOfCommitment: number;
  languages: number;
}

export type MetricId =
  | 'texts'
  | 'tags'
  | 'disambiguated'
  | 'places'
  | 'entities'
  | 'published'
  | 'wetWork'
  | 'flagOfCommitment';

/** A name/description given in both languages — fr defaults to the en text
 * until a real translation is written. */
export interface LocalizedText {
  fr: string;
  en: string;
}

export interface RankMedalDef {
  metric: MetricId;
  /** Medal (decoration) name, e.g. "Ordre du Chevron / Order of the Chevron". */
  medalName: LocalizedText;
  description: LocalizedText;
  /** One threshold per class, VIIème classe → Ière classe. */
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
