import type { SourceDescription } from './sourceDescription';

/** Source fields shared via global profiles; transcription source stays per-file. */
export type SharedSourceDescription = Omit<SourceDescription, 'sourceNote'>;

export interface SourceProfile {
  id: string;
  label: string;
  identityKey: string;
  source: SharedSourceDescription;
  updatedAt: string;
}

export interface SourceProfileFile {
  version: 1;
  profiles: SourceProfile[];
}

export interface DedupedProjectSource {
  identityKey: string;
  label: string;
  source: SharedSourceDescription;
  fileCount: number;
  samplePath: string;
}
