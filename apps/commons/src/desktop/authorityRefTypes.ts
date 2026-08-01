/**
 * Shared types for A6 authorityRef:lookup (reference-tier person enrichment).
 */

export type AuthorityRefSourceId = 'cbdb' | 'dila' | 'norbert';

export interface AuthorityRefLookupRequest {
  source: AuthorityRefSourceId;
  authorityId: string;
}

/** Normalized enrichment payload written into the user entity database. */
export interface AuthorityRefLookupResult {
  source: string;
  authorityId: string;
  primaryName?: string;
  names?: Array<{ text: string; type?: string; lang?: string }>;
  metadata?: {
    dynasty?: string;
    nationality?: unknown[];
    origin?: unknown[];
    appointments?: unknown[];
    nobleTitles?: unknown[];
    startYear?: number;
    endYear?: number;
    description?: string;
    sourceDescription?: string;
    [key: string]: unknown;
  };
}
