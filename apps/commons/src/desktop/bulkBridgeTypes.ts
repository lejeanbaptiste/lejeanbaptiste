import type {
  BulkBridgeProgress,
  BulkBridgeResult,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/bulkBridgeImport';

export interface BulkBridgeJobRequest {
  sourceEntitiesPath: string;
  centralEntitiesPath: string;
  centralGrognardDir: string;
  userStableId: string;
  chunkSize?: number;
}

export interface BulkBridgeJobEvent {
  jobId: string;
  status: 'progress' | 'complete' | 'error' | 'cancelled';
  progress?: BulkBridgeProgress;
  result?: BulkBridgeResult;
  error?: string;
}
