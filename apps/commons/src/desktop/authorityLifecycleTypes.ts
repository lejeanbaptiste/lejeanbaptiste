/**
 * Shared types for offline authority lifecycle (download → compile → update).
 */

import type { AuthoritySourceId, AuthoritySourceStatus } from './authorityDbTypes';
import type { AuthorityPackStatus } from './authorityPackTypes';

export type AuthorityLifecycleProfile = 'chinese' | 'japanese' | 'tibetan';

/** Matches `policy.version` in compiled pack manifests (authority extraction). */
export const COMPILE_POLICY_VERSION = '2026-07-05';

export const LIFECYCLE_FILENAME = 'lifecycle.json';

export interface AuthorityLifecycleConfig {
  version: 1;
  enabled: boolean;
  profile?: AuthorityLifecycleProfile;
  /** When true, also download raw CBDB/DILA into authority-databases/ for reference lookup. */
  referenceDataEnabled?: boolean;
  lastCheckAt?: string;
  compilePolicyVersion?: string;
  packBundleVersion?: string;
  declinedFirstPrompt?: boolean;
  lastError?: string;
}

export type AuthorityLifecyclePhase =
  | 'downloading'
  | 'extracting'
  | 'compiling'
  | 'idle';

export interface AuthorityLifecycleProgress {
  phase: AuthorityLifecyclePhase;
  message: string;
  sourceId?: AuthoritySourceId;
  receivedBytes?: number;
  totalBytes?: number | null;
}

export interface AuthorityLifecycleDiskUsage {
  rawBytes: number;
  packBytes: number;
}

export interface AuthorityLifecycleStatus {
  enabled: boolean;
  profile: AuthorityLifecycleProfile;
  entityDbFolder: string | null;
  entityDbReady: boolean;
  label: string;
  rawSources: AuthoritySourceStatus[];
  packs: AuthorityPackStatus[];
  packsReady: boolean;
  diskUsage: AuthorityLifecycleDiskUsage | null;
  updateAvailable: boolean;
  compilePolicyVersion: string;
  packBundleVersion?: string;
  referenceDataEnabled: boolean;
  lastCheckAt?: string;
  declinedFirstPrompt: boolean;
  busy: boolean;
  lastError?: string;
}

export interface AuthorityLifecycleSetEnabledOptions {
  enabled: boolean;
  profile?: AuthorityLifecycleProfile;
  deleteFiles?: boolean;
}

export interface AuthorityLifecycleRunResult {
  ok: boolean;
  error?: string;
}
