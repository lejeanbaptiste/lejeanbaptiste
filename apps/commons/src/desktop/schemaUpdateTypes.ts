import type { ProjectBundle } from './projectTypes';

export type SchemaUpdateCheckResult =
  | { status: 'skipped'; reason: string }
  | {
      status: 'current';
      catalogLabel?: string;
      localVersion?: string;
      remoteVersion?: string;
    }
  | {
      status: 'updateAvailable';
      catalogId: string;
      catalogLabel: string;
      cssChanged: boolean;
      localVersion?: string;
      remoteVersion?: string;
      rngChanged: boolean;
    };

export interface SchemaUpdateApplyResult {
  bundle: ProjectBundle | null;
  metadataWarnings: string[];
}

export interface SchemaUpdateCheckOptions {
  force?: boolean;
}
