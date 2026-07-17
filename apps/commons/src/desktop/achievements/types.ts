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
  languages: number;
}

export type MetricId = 'texts' | 'tags' | 'disambiguated' | 'places' | 'entities';

export interface RankMedalDef {
  metric: MetricId;
  /** Medal (decoration) name, e.g. "Order of the Angle Bracket". */
  medalName: string;
  description: string;
  /** One threshold per rank, Private → General. */
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
