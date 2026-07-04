/**
 * Shared renderer/main types for the authority-database download manager
 * (auto-tagging Phase A1). The implementation lives in
 * apps/desktop/src/authorityDatabases.ts.
 */

export type AuthoritySourceId = 'cbdb' | 'dila';

export interface AuthoritySourceStatus {
  id: AuthoritySourceId;
  label: string;
  installed: boolean;
  /** Installed version from the manifest when installed. */
  version?: string;
  installedAt?: string;
}

export interface AuthorityDownloadProgress {
  sourceId: AuthoritySourceId;
  fileName: string;
  phase: 'downloading' | 'extracting';
  receivedBytes: number;
  totalBytes: number | null;
}
