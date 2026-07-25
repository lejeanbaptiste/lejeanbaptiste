/**
 * Renderer adapter for the cjk-dates plugin Python backend.
 * Replaces direct sanmiao:* IPC calls.
 */

import type {
  SanmiaoBatchProposeFn,
  SanmiaoBatchResolveFn,
  SanmiaoBatchTagFn,
  SanmiaoChunkProgressEvent,
  SanmiaoProposal,
  SanmiaoProposeOptions,
} from '../autoTagging/sanmiaoDateTypes';
import type { DateAuthorityIndex } from '../dateAuthority/types';

const CJK_DATES_PLUGIN = 'cjk-dates';

export function isCjkDatesPythonAvailable(): boolean {
  return Boolean(window.electronAPI?.pluginsInvokePython);
}

async function invokePython<T>(
  payload: Record<string, unknown>,
  onChunk?: (event: SanmiaoChunkProgressEvent) => void,
): Promise<T> {
  const invoke = window.electronAPI?.pluginsInvokePython;
  if (!invoke) {
    throw new Error('Plugin Python API is not available. Restart the desktop app.');
  }
  const stop = onChunk
    ? window.electronAPI?.onPluginPythonProgress?.(CJK_DATES_PLUGIN, (event) => {
        onChunk(event as SanmiaoChunkProgressEvent);
      })
    : undefined;
  try {
    return (await invoke(CJK_DATES_PLUGIN, payload)) as T;
  } finally {
    stop?.();
  }
}

export const cjkDatesProposeDates = async (
  text: string,
  options: SanmiaoProposeOptions = {},
): Promise<SanmiaoProposal[]> => {
  const result = await invokePython<SanmiaoProposal[]>({ text, ...options });
  return Array.isArray(result) ? result : [];
};

export const cjkDatesProposeDatesBatch: SanmiaoBatchProposeFn = async (chunks, options, onChunk) => {
  const result = await invokePython<SanmiaoProposal[][]>({ chunks, ...options }, onChunk);
  return Array.isArray(result) ? result : [];
};

export const cjkDatesTagDatesBatch: SanmiaoBatchTagFn = async (chunks, options, onChunk) => {
  const result = await invokePython<SanmiaoProposal[][]>(
    { mode: 'tag', chunks, ...options },
    onChunk,
  );
  return Array.isArray(result) ? result : [];
};

export const cjkDatesResolveDatesBatch: SanmiaoBatchResolveFn = async (dates, options, onChunk) => {
  const result = await invokePython<(SanmiaoProposal | null)[]>(
    { mode: 'resolve', dates, ...options },
    onChunk,
  );
  return Array.isArray(result) ? result : [];
};

export const cjkDatesListDateAuthority = async (
  options: SanmiaoProposeOptions = {},
): Promise<DateAuthorityIndex> => {
  const result = await invokePython<DateAuthorityIndex>({ mode: 'authority', ...options });
  return {
    dynasties: Array.isArray(result?.dynasties) ? result.dynasties : [],
    rulers: Array.isArray(result?.rulers) ? result.rulers : [],
    eras: Array.isArray(result?.eras) ? result.eras : [],
  };
};
