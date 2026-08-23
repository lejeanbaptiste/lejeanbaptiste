/** Shared sanmiao / East Asian date tagging types (no runtime imports from dates.ts). */

export interface SanmiaoProposeOptions {
  civ?: string[];
  sequential?: boolean;
  fuzzy?: boolean;
  tpq?: number;
  taq?: number;
  pg?: boolean;
  lang?: string;
}

export interface SanmiaoProposal {
  date_index: number;
  date_string: string;
  status: 'unique' | 'ambiguous' | 'unresolved' | 'tagged';
  candidates: {
    displayLine: string;
    attrs?: Record<string, string>;
    era_id?: number | null;
    dyn_id?: number | null;
    error_str?: string | null;
  }[];
  attrs?: Record<string, string>;
  parseInnerXml?: string;
}

export type SanmiaoChunkProgressEvent =
  | { type: 'init'; total: number; tablesMs: number }
  | {
      type: 'chunk';
      index: number;
      done: number;
      total: number;
      ms: number;
      chars: number;
      proposals: number;
      skipped: boolean;
    };

export type SanmiaoBatchTagFn = (
  chunks: string[],
  options: SanmiaoProposeOptions,
  onChunk?: (event: SanmiaoChunkProgressEvent) => void,
) => Promise<SanmiaoProposal[][]>;

export type SanmiaoBatchResolveFn = (
  dateXml: string[],
  options: SanmiaoProposeOptions,
  onChunk?: (event: SanmiaoChunkProgressEvent) => void,
) => Promise<(SanmiaoProposal | null)[]>;

export type SanmiaoBatchProposeFn = (
  chunks: string[],
  options: SanmiaoProposeOptions,
  onChunk?: (event: SanmiaoChunkProgressEvent) => void,
) => Promise<SanmiaoProposal[][]>;

export interface DateTagProgress {
  phase: 'starting' | 'chunk' | 'mapping' | 'done';
  done: number;
  total: number;
  tablesMs?: number;
  ms?: number;
  chars?: number;
  proposalsInChunk?: number;
  suggestionsSoFar?: number;
}

export interface DateTagOptions extends SanmiaoProposeOptions {
  onProgress?: (progress: DateTagProgress) => void;
  /** Split by paragraph when taggable body text exceeds this (default 20_000). */
  splitThresholdChars?: number;
}
