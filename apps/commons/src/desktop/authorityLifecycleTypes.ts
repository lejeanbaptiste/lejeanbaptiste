/**
 * Shared types for offline authority lifecycle (download → compile → update).
 */

import type { AuthoritySourceId, AuthoritySourceStatus } from './authorityDbTypes';
import type { AuthorityPackStatus } from './authorityPackTypes';

export type AuthorityLifecycleProfile = 'chinese' | 'japanese' | 'tibetan';

export const ALL_AUTHORITY_PROFILES: AuthorityLifecycleProfile[] = [
  'chinese',
  'japanese',
  'tibetan',
];

/** Matches `policy.version` in compiled pack manifests (authority extraction). */
export const COMPILE_POLICY_VERSION = '2026-07-05';

export const LIFECYCLE_FILENAME = 'lifecycle.json';

export interface AuthorityLifecycleConfig {
  version: 1;
  enabled: boolean;
  /** Legacy single profile; superseded by `profiles`. Still read from old lifecycle.json files. */
  profile?: AuthorityLifecycleProfile;
  /** Independently enabled language packs. When absent, derived from `enabled` + `profile`. */
  profiles?: AuthorityLifecycleProfile[];
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

export interface AuthorityLifecycleProfileStatus {
  id: AuthorityLifecycleProfile;
  label: string;
  enabled: boolean;
  installedPacks: number;
  totalPacks: number;
  packsReady: boolean;
}

export interface AuthorityLifecycleStatus {
  enabled: boolean;
  /** Legacy: first enabled profile (or 'chinese'). Prefer `profileStatuses`. */
  profile: AuthorityLifecycleProfile;
  profileStatuses: AuthorityLifecycleProfileStatus[];
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
