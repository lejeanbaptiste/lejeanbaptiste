export interface KanripoDaozangConcordanceEntry {
  kr_id: string;
  dz_id: string;
  daozang_rel_path: string;
  daozang_title: string;
  match_method: string;
  title: string;
  note: string;
}

export interface KanripoConcordanceLookupResult {
  kr_id: string;
  dz_id: string;
  daozang: KanripoDaozangConcordanceEntry | null;
}

/** Load bundled Daozang parallel text for a Kanripo work id (when concordance + corpus exist). */
export const loadBundledDaozangParallel = async (
  krId: string,
): Promise<{
  entry: KanripoDaozangConcordanceEntry | null;
  text: string | null;
  label: string | null;
}> => {
  const api = window.electronAPI;
  if (!api?.pluginsInvokePython || !api.daozangStatus || !api.daozangReadText) {
    return { entry: null, text: null, label: null };
  }

  const status = await api.daozangStatus();
  if (!status.ready) {
    return { entry: null, text: null, label: null };
  }

  const lookup = (await api.pluginsInvokePython('kanripo-import', {
    op: 'concordance_lookup',
    kr_id: krId,
  })) as KanripoConcordanceLookupResult;

  const entry = lookup.daozang;
  if (!entry?.daozang_rel_path?.trim()) {
    return { entry: null, text: null, label: null };
  }

  const read = await api.daozangReadText(entry.daozang_rel_path);
  const text = read.text?.trim() ? read.text : null;
  const label = entry.daozang_title?.trim() || entry.daozang_rel_path;
  return { entry, text, label };
};
