import type { EntitySummary } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';

export interface EntityIndexJobRequest {
  entitiesPath: string;
  indexCachePath?: string;
  chunkSize?: number;
}

export interface EntityIndexJobEvent {
  jobId: string;
  status: 'progress' | 'complete' | 'error' | 'cancelled';
  phase?: 'parsing' | 'indexing' | 'cache';
  done?: number;
  total?: number;
  batch?: EntitySummary[];
  error?: string;
}
