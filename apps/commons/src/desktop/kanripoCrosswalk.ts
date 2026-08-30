export interface ParallelSourceEntry {
  kind: 'wikisource' | 'daozang' | string;
  label: string;
  url?: string;
  ws_page?: string;
  rel_path?: string;
  dz_id?: string;
}

export interface ParallelCrosswalkEntry {
  kr_id: string;
  title: string;
  dz_id: string;
  cbeta_id: string;
  wikidata_work_qid: string;
  sources: ParallelSourceEntry[];
}

export interface KanripoConcordanceLookupResult {
  kr_id: string;
  dz_id: string;
  daozang: {
    kr_id: string;
    dz_id: string;
    daozang_rel_path: string;
    daozang_title: string;
    match_method: string;
    title: string;
    note: string;
  } | null;
  parallel_crosswalk?: ParallelCrosswalkEntry | null;
}

export const lookupKanripoCrosswalk = async (
  krId: string,
): Promise<ParallelCrosswalkEntry | null> => {
  const api = window.electronAPI;
  if (!api?.pluginsInvokePython) return null;
  const result = (await api.pluginsInvokePython('kanripo-import', {
    op: 'concordance_lookup',
    kr_id: krId,
  })) as KanripoConcordanceLookupResult;
  return result.parallel_crosswalk ?? null;
};

export const wikisourceSources = (
  crosswalk: ParallelCrosswalkEntry | null,
): ParallelSourceEntry[] =>
  (crosswalk?.sources ?? []).filter((source) => source.kind === 'wikisource' && source.url);

export const daozangSources = (
  crosswalk: ParallelCrosswalkEntry | null,
): ParallelSourceEntry[] =>
  (crosswalk?.sources ?? []).filter((source) => source.kind === 'daozang' && source.rel_path);
