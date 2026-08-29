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

export type DaozangParallelLoadIssue =
  | 'missing-api'
  | 'plugin-disabled'
  | 'corpus-not-ready'
  | 'no-concordance'
  | 'empty-text'
  | 'lookup-failed';

export interface DaozangParallelLoadResult {
  entry: KanripoDaozangConcordanceEntry | null;
  text: string | null;
  label: string | null;
  issue: DaozangParallelLoadIssue | null;
  detail?: string;
}

/** Load bundled Daozang parallel text for a Kanripo work id (when concordance + corpus exist). */
export const loadBundledDaozangParallel = async (
  krId: string,
  options?: { pluginEnabled?: boolean },
): Promise<DaozangParallelLoadResult> => {
  const api = window.electronAPI;
  if (!api?.pluginsInvokePython || !api.daozangStatus) {
    return {
      entry: null,
      text: null,
      label: null,
      issue: 'missing-api',
      detail: 'Restart the desktop app to pick up Daozang parallel support.',
    };
  }
  if (!api.daozangReadText) {
    return {
      entry: null,
      text: null,
      label: null,
      issue: 'missing-api',
      detail: 'This build is missing daozang:readText — restart or rebuild the desktop app.',
    };
  }

  if (options?.pluginEnabled === false) {
    return {
      entry: null,
      text: null,
      label: null,
      issue: 'plugin-disabled',
      detail: 'Enable “Daozang import” in Tools → Plugins for this project.',
    };
  }

  const status = await api.daozangStatus();
  if (!status.ready) {
    return {
      entry: null,
      text: null,
      label: null,
      issue: 'corpus-not-ready',
      detail:
        'Daozang corpus is not ready. Open File → Import from Daozang… to verify the bundled corpus, or install from a local copy.',
    };
  }

  let lookup: KanripoConcordanceLookupResult;
  try {
    lookup = (await api.pluginsInvokePython('kanripo-import', {
      op: 'concordance_lookup',
      kr_id: krId,
    })) as KanripoConcordanceLookupResult;
  } catch (error) {
    return {
      entry: null,
      text: null,
      label: null,
      issue: 'lookup-failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const entry = lookup.daozang;
  if (!entry?.daozang_rel_path?.trim()) {
    return {
      entry: null,
      text: null,
      label: null,
      issue: 'no-concordance',
      detail: `No bundled Daozang match for ${krId}. Reinstall the Kanripo import plugin if you recently added the concordance tables.`,
    };
  }

  try {
    const read = await api.daozangReadText(entry.daozang_rel_path);
    const text = read.text?.trim() ? read.text : null;
    if (!text) {
      return {
        entry,
        text: null,
        label: entry.daozang_title?.trim() || entry.daozang_rel_path,
        issue: 'empty-text',
        detail: `Matched ${entry.daozang_rel_path} but the file is empty.`,
      };
    }
    const label = entry.daozang_title?.trim() || entry.daozang_rel_path;
    return { entry, text, label, issue: null };
  } catch (error) {
    return {
      entry,
      text: null,
      label: entry.daozang_title?.trim() || entry.daozang_rel_path,
      issue: 'lookup-failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
};

export const daozangParallelIssueMessage = (issue: DaozangParallelLoadIssue | null): string => {
  switch (issue) {
    case 'missing-api':
      return 'Daozang parallel support is not available in this app session.';
    case 'plugin-disabled':
      return 'Enable the Daozang import plugin for this project.';
    case 'corpus-not-ready':
      return 'The Daozang corpus is not installed or not ready.';
    case 'no-concordance':
      return 'No concordance entry links this Kanripo id to a bundled Daozang file.';
    case 'empty-text':
      return 'A Daozang file matched but contained no text.';
    case 'lookup-failed':
      return 'Could not load the matched Daozang file.';
    default:
      return '';
  }
};
