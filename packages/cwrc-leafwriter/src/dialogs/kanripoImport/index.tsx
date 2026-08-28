import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Radio,
  RadioGroup,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  uniqueKanripoXmlPath,
  wrapKanripoTeiDocument,
  type KanripoNormalizeMode,
  type KanripoTeiMeta,
} from '../../../../../apps/commons/src/desktop/kanripoImportXml';
import { loadParallelPlainText } from '../../../../../apps/commons/src/desktop/kanripoParallelText';
import { loadBundledDaozangParallel } from '../../../../../apps/commons/src/desktop/kanripoDaozangParallel';
import {
  appendTeiRevisionChange,
  formatParallelProvenance,
} from '../../../../../apps/commons/src/desktop/kanripoImportXml';
import {
  ctextChapterUrlFromIndex,
  isCtextWikiResUrl,
  isCtextWikiUrl,
  isWikisourceUrl,
  unsupportedCtextUrlMessage,
} from '../../../../../apps/commons/src/desktop/parallelUrlFetch';
import type { IDialog } from '../type';
import { isPluginEnabled } from '../../plugins';

const PLUGIN_ID = 'kanripo-import';
const DAOZANG_PLUGIN_ID = 'daozang-import';

const CTEXT_IMPORT_MESSAGE =
  'ctext wiki URLs are for in-editor punctuation only (Segment and punctuate on one open juan). For import, use Wikisource, a file, or paste.';

interface KanripoWorkHit {
  id: string;
  title: string;
  author?: string;
  dynasty?: string;
}

interface ConvertPayload {
  meta: KanripoTeiMeta;
  body_xml: string;
}

interface CoverageSpan {
  start: number;
  end: number;
  covered_chars: number;
  source: string;
  preview: string;
}

interface Coverage {
  start: number;
  end: number;
  covered_chars: number;
  total_chars: number;
  ratio: number;
  empty: boolean;
  spans?: CoverageSpan[];
}

interface ParallelSource {
  id: string;
  label: string;
  text: string;
  kind?: 'file' | 'paste' | 'ctext' | 'wikisource' | 'url' | 'daozang';
  url?: string;
}

interface DaozangMatchInfo {
  krId: string;
  title: string;
  dzId: string;
  matchMethod: string;
}

type ParallelAlignMode = 'tape' | 'segmented';

interface ParallelPunctPayload {
  body_xml: string;
  coverage: Coverage;
  applied: boolean;
}

export interface KanripoImportDialogProps extends IDialog {
  variant?: 'import' | 'punctuate';
}

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/+/g, '/');

const parentDir = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
};

const xmlLooksWellFormed = (xml: string): boolean => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return !doc.querySelector('parsererror');
};

const extractJuanDiv = (xml: string): string | null => {
  const juan = xml.match(/<div\b[^>]*type="juan"[^>]*>[\s\S]*?<\/div>/);
  if (juan) return juan[0];
  const body = xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/);
  return body?.[1]?.trim() || null;
};

const replaceJuanDiv = (xml: string, bodyXml: string): string => {
  if (/<div\b[^>]*type="juan"/.test(xml)) {
    return xml.replace(/<div\b[^>]*type="juan"[^>]*>[\s\S]*?<\/div>/, bodyXml.trim());
  }
  return xml.replace(/<body\b[^>]*>[\s\S]*?<\/body>/, `<body>\n${bodyXml.trim()}\n</body>`);
};

const barSegments = (coverage: Coverage): CoverageSpan[] => {
  if (coverage.spans && coverage.spans.length > 0) return coverage.spans;
  if (coverage.empty) return [];
  return [
    {
      start: coverage.start,
      end: coverage.end,
      covered_chars: coverage.covered_chars,
      source: '',
      preview: '',
    },
  ];
};

const CoverageBar = ({ coverage, label }: { coverage: Coverage; label: string }) => {
  const spans = barSegments(coverage);
  const pct = Math.round(coverage.ratio * 100);
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption">
        {label}:{' '}
        {coverage.empty
          ? 'no overlap'
          : `${coverage.covered_chars} / ${coverage.total_chars} characters (${pct}%)`}
      </Typography>
      <Box
        sx={{
          position: 'relative',
          height: 12,
          bgcolor: 'grey.300',
          borderRadius: 0.5,
          overflow: 'hidden',
          mt: 0.5,
        }}
      >
        {spans.map((span, index) => {
          const left = Math.max(0, Math.min(100, span.start * 100));
          const width = Math.max(0, Math.min(100 - left, (span.end - span.start) * 100));
          const title = [span.source, span.preview].filter(Boolean).join(': ') || 'overlap';
          return (
            <Tooltip key={`${span.source}-${index}`} title={title}>
              <Box
                sx={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${width}%`,
                  top: 0,
                  bottom: 0,
                  bgcolor: 'success.main',
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

export const KanripoImportDialog = ({
  onClose,
  open = false,
  variant = 'import',
}: KanripoImportDialogProps) => {
  const punctuateOnly = variant === 'punctuate';
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<KanripoWorkHit[]>([]);
  const [selected, setSelected] = useState<KanripoWorkHit | null>(null);
  const [normalize, setNormalize] = useState<KanripoNormalizeMode>('off');
  const [punctMode, setPunctMode] = useState<'as-is' | 'parallel'>(
    punctuateOnly ? 'parallel' : 'as-is',
  );
  const [alignMode, setAlignMode] = useState<ParallelAlignMode>(
    punctuateOnly ? 'segmented' : 'tape',
  );
  const [sources, setSources] = useState<ParallelSource[]>([]);
  const [pasteDraft, setPasteDraft] = useState('');
  const [pasteCount, setPasteCount] = useState(0);
  const [ctextUrl, setCtextUrl] = useState('');
  const [ctextSection, setCtextSection] = useState('');
  const [ctextContains, setCtextContains] = useState('');
  const [ctextSections, setCtextSections] = useState<
    { id: string; slug: string; title: string; rowCount: number }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    written: string[];
    failed: { stem: string; message: string }[];
    bars?: { stem: string; coverage: Coverage }[];
  } | null>(null);
  const [editorPreview, setEditorPreview] = useState<{
    xml: string;
    body: string;
    coverage: Coverage;
  } | null>(null);
  const [stampCoverage, setStampCoverage] = useState<Coverage | null>(null);
  const [daozangMatch, setDaozangMatch] = useState<DaozangMatchInfo | null>(null);

  const projectReady = Boolean(window.__leafWriterProject?.isProjectReady?.());
  const hasSources = sources.some((source) => source.text.trim());

  const search = useCallback(async (text: string) => {
    const api = window.electronAPI?.kanripoSearch;
    if (!api) return;
    const next = await api(text);
    setHits(next);
    setSelected((current) => {
      if (current && next.some((hit) => hit.id === current.id)) return current;
      return next[0] ?? null;
    });
  }, []);

  useEffect(() => {
    if (!open || punctuateOnly) return;
    void search('');
  }, [open, punctuateOnly, search]);

  useEffect(() => {
    if (!open || punctuateOnly) return;
    const handle = window.setTimeout(() => {
      void search(query);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [open, punctuateOnly, query, search]);

  useEffect(() => {
    if (!open || !punctuateOnly) {
      setStampCoverage(null);
      return;
    }
    const xml = window.__leafWriterProject?.getActiveFileXml?.() ?? '';
    const body = extractJuanDiv(xml);
    const api = window.electronAPI?.pluginsInvokePython;
    if (!body || !api) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = (await api(PLUGIN_ID, {
          op: 'parallel_punct',
          stamps_only: true,
          body_xml: body,
        })) as ParallelPunctPayload;
        if (!cancelled) setStampCoverage(result.coverage);
      } catch {
        if (!cancelled) setStampCoverage(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, punctuateOnly]);

  const applyBundledDaozangParallel = useCallback(async (krId: string) => {
    if (!isPluginEnabled(DAOZANG_PLUGIN_ID)) {
      setDaozangMatch(null);
      setSources((current) => current.filter((source) => source.kind !== 'daozang'));
      return;
    }
    const { entry, text, label } = await loadBundledDaozangParallel(krId);
    if (!entry || !text) {
      setDaozangMatch(null);
      setSources((current) => current.filter((source) => source.kind !== 'daozang'));
      return;
    }
    const resolvedLabel = label ?? entry.daozang_title;
    setDaozangMatch({
      krId,
      title: resolvedLabel,
      dzId: entry.dz_id,
      matchMethod: entry.match_method,
    });
    setAlignMode('tape');
    setSources((current) => [
      ...current.filter((source) => source.kind !== 'daozang'),
      {
        id: `daozang-${krId}`,
        label: resolvedLabel,
        text,
        kind: 'daozang',
      },
    ]);
    setStatus(
      `Bundled Daozang match for ${krId}: ${resolvedLabel} (${text.trim().length} characters).`,
    );
  }, []);

  useEffect(() => {
    if (!open || punctuateOnly || punctMode !== 'parallel' || !selected?.id) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await applyBundledDaozangParallel(selected.id);
      } catch (loadError) {
        if (!cancelled) {
          setDaozangMatch(null);
          setSources((current) => current.filter((source) => source.kind !== 'daozang'));
          console.warn('[kanripo-import] Daozang parallel load failed:', loadError);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, punctuateOnly, punctMode, selected?.id, applyBundledDaozangParallel]);

  const secondaryFor = (hit: KanripoWorkHit) =>
    [hit.author, hit.dynasty].filter(Boolean).join(' · ');

  const invokeParallel = async (bodyXml: string): Promise<ParallelPunctPayload> => {
    const api = window.electronAPI;
    if (!api?.pluginsInvokePython) throw new Error('Python bridge unavailable.');
    return (await api.pluginsInvokePython(PLUGIN_ID, {
      op: 'parallel_punct',
      mode: alignMode,
      body_xml: bodyXml,
      sources: sources.map((source) => ({
        id: source.id,
        label: source.label,
        text: source.text,
      })),
    })) as ParallelPunctPayload;
  };

  const fetchParallelUrl = async (overrideUrl?: string) => {
    const api = window.electronAPI;
    const fetcher = api?.kanripoFetchParallelUrl ?? api?.kanripoFetchCtextParallel;
    if (!fetcher) {
      setError('URL fetch is only available in the desktop app.');
      return;
    }
    const url = (overrideUrl ?? ctextUrl).trim();
    if (!url) {
      setError(
        punctuateOnly
          ? 'Paste a parallel URL first (ctext wiki, Wikisource, or other).'
          : 'Paste a Wikisource URL, or add a file or paste below.',
      );
      return;
    }
    if (!punctuateOnly && isCtextWikiUrl(url)) {
      setError(CTEXT_IMPORT_MESSAGE);
      return;
    }
    const ctextHint = unsupportedCtextUrlMessage(url);
    if (ctextHint) {
      setError(ctextHint);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await fetcher({
        url,
        section: punctuateOnly ? ctextSection.trim() || undefined : undefined,
        contains: punctuateOnly ? ctextContains.trim() || undefined : undefined,
        fetchAll: !punctuateOnly && isWikisourceUrl(url) ? true : undefined,
      });
      if (!result.text.trim()) {
        setError('That URL returned no text.');
        return;
      }
      if (result.sections?.length) {
        setCtextSections(result.sections);
      }
      const kind =
        'kind' in result && result.kind
          ? (result.kind as ParallelSource['kind'])
          : isCtextWikiUrl(url)
            ? 'ctext'
            : 'url';
      if (kind === 'ctext' && punctuateOnly) {
        setAlignMode('segmented');
      } else if (!punctuateOnly && isWikisourceUrl(url)) {
        setAlignMode('tape');
      }
      setSources((current) => [
        ...current,
        {
          id: `url-${result.label}-${Date.now()}`,
          label: result.label,
          text: result.text,
          kind,
          url,
        },
      ]);
      setStatus(`Fetched ${result.label} (${result.text.trim().length} characters).`);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
    } finally {
      setBusy(false);
    }
  };

  const listCtextSections = async () => {
    const api = window.electronAPI;
    const url = ctextUrl.trim();
    if (!api?.kanripoListCtextSections || !url) return;
    setBusy(true);
    setError(null);
    try {
      const sections = await api.kanripoListCtextSections(url);
      setCtextSections(sections);
      setStatus(
        sections.length
          ? `Found ${sections.length} sections on that wiki page.`
          : 'No section headings found on that page.',
      );
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : String(listError));
    } finally {
      setBusy(false);
    }
  };

  const listWikisourceVolumes = async () => {
    const api = window.electronAPI;
    const url = ctextUrl.trim();
    if (!api?.kanripoListWikisourceVolumes || !url) return;
    setBusy(true);
    setError(null);
    try {
      const sections = await api.kanripoListWikisourceVolumes(url);
      setCtextSections(sections);
      setStatus(
        sections.length
          ? `Found ${sections.length} Wikisource 卷 pages (Fetch URL loads all of them on import).`
          : 'No 卷 pages found under that Wikisource URL.',
      );
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : String(listError));
    } finally {
      setBusy(false);
    }
  };

  const addPasteSource = () => {
    const text = pasteDraft.trim();
    if (!text) return;
    const next = pasteCount + 1;
    setPasteCount(next);
    setSources((current) => [...current, { id: `paste-${next}`, label: `Paste ${next}`, text }]);
    setPasteDraft('');
  };

  const addFiles = async () => {
    const api = window.electronAPI;
    if (!api?.pickDocumentImportSources) {
      setError('File picking is only available in the desktop app.');
      return;
    }
    setError(null);
    const picked = await api.pickDocumentImportSources();
    if (!picked?.length) return;
    setBusy(true);
    try {
      const added: ParallelSource[] = [];
      for (const item of picked) {
        const loaded = await loadParallelPlainText({
          format: item.format,
          sourcePath: item.sourcePath,
        });
        if (!loaded.text.trim()) continue;
        added.push({
          id: `file-${item.sourcePath}`,
          label: loaded.label,
          text: loaded.text,
        });
      }
      if (added.length === 0) {
        setError('Those files had no usable text.');
        return;
      }
      setSources((current) => [...current, ...added]);
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : String(pickError));
    } finally {
      setBusy(false);
    }
  };

  const canRunImport = Boolean(
    selected &&
    projectReady &&
    !busy &&
    window.electronAPI?.kanripoClone &&
    (punctMode === 'as-is' || hasSources),
  );

  const runImport = async () => {
    if (!selected) return;
    const project = window.__leafWriterProject;
    const rootPath = project?.getProjectRootPath?.();
    const config = project?.getProjectConfig?.();
    if (!project || !projectReady || !rootPath || !config) {
      setError('Open a project before importing from Kanripo.');
      return;
    }
    const api = window.electronAPI;
    if (!api?.kanripoClone || !api.pluginsInvokePython || !api.writeFile || !api.ensureDirectory) {
      setError('Kanripo import is only available in the desktop app.');
      return;
    }

    if (punctMode === 'parallel') {
      const hasCtextSource = sources.some(
        (source) => source.kind === 'ctext' || (source.url && isCtextWikiUrl(source.url)),
      );
      if (hasCtextSource) {
        setError(CTEXT_IMPORT_MESSAGE);
        return;
      }
    }

    setBusy(true);
    setError(null);
    setReport(null);
    setStatus(`Cloning ${selected.id}…`);

    let cloned = false;
    const written: string[] = [];
    const failed: { stem: string; message: string }[] = [];
    const bars: { stem: string; coverage: Coverage }[] = [];

    try {
      const clone = await api.kanripoClone(selected.id);
      cloned = true;
      const files = clone.files ?? [];
      if (files.length === 0) {
        throw new Error(`No .txt files found in ${selected.id}.`);
      }

      const destDir = joinPath(rootPath, 'imported', 'kanripo', selected.id);
      await api.ensureDirectory(destDir);
      const used = new Set<string>();
      const existingEntries = (await api.readDirectory?.(destDir, { allFiles: true })) ?? [];
      for (const entry of existingEntries) {
        if (!entry.isDirectory && entry.name.toLowerCase().endsWith('.xml')) {
          used.add(joinPath(destDir, entry.name).replace(/\\/g, '/'));
        }
      }

      for (let i = 0; i < files.length; i += 1) {
        const filePath = files[i];
        const stem =
          filePath
            .replace(/\\/g, '/')
            .split('/')
            .pop()
            ?.replace(/\.txt$/i, '') ?? 'juan';
        setStatus(`Converting ${stem} (${i + 1} of ${files.length})…`);
        try {
          const converted = (await api.pluginsInvokePython(PLUGIN_ID, {
            path: filePath,
            normalize,
            gaiji_dest_dir: joinPath(destDir, '_gaiji'),
          })) as ConvertPayload;
          if (!converted?.body_xml || !converted.meta) {
            throw new Error('Python conversion returned no TEI body.');
          }
          let bodyXml = converted.body_xml;
          let punctNote: string | undefined;
          if (punctMode === 'parallel') {
            setStatus(`Punctuating ${stem} (${i + 1} of ${files.length})…`);
            const punct = await invokeParallel(bodyXml);
            bars.push({ stem, coverage: punct.coverage });
            if (punct.applied) {
              bodyXml = punct.body_xml;
              punctNote = formatParallelProvenance(sources, alignMode);
            }
          }
          const xml = wrapKanripoTeiDocument({
            config,
            meta: { ...converted.meta, normalize, stem: converted.meta.stem || stem },
            bodyXml,
            punctNote,
          });
          if (!xmlLooksWellFormed(xml)) {
            throw new Error('Wrapped TEI is not well-formed XML.');
          }
          const outputPath = uniqueKanripoXmlPath(destDir, converted.meta.stem || stem, used);
          const dir = parentDir(outputPath);
          if (dir) await api.ensureDirectory(dir);
          await api.writeFile(outputPath, xml);
          written.push(outputPath);
        } catch (itemError) {
          failed.push({
            stem,
            message: itemError instanceof Error ? itemError.message : String(itemError),
          });
        }
      }

      if (failed.length === 0) {
        await api.kanripoFlush?.(selected.id);
        cloned = false;
      }

      await project.refreshExplorer?.();
      for (const outputPath of written) {
        await project.reloadFileFromDisk?.(outputPath);
      }
      setReport({ written, failed, bars });
      setStatus(
        failed.length === 0
          ? `Imported ${written.length} juan.`
          : `Imported ${written.length} juan; ${failed.length} failed. The clone was kept so you can retry.`,
      );

      if (written.length === 1 && failed.length === 0) {
        await project.openFile?.(written[0]);
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
      setStatus('');
      if (cloned && written.length === 0) {
        // Keep the clone on failure so a retry does not re-download.
      }
    } finally {
      setBusy(false);
    }
  };

  const previewEditor = async () => {
    setError(null);
    setEditorPreview(null);
    const xml = window.__leafWriterProject?.getActiveFileXml?.() ?? '';
    const body = extractJuanDiv(xml);
    if (!body) {
      setError('Open a Kanripo TEI file (with a juan div) first.');
      return;
    }
    if (!hasSources) {
      setError('Add a punctuated parallel (file or paste).');
      return;
    }
    setBusy(true);
    try {
      const punct = await invokeParallel(body);
      setEditorPreview({ xml, body: punct.body_xml, coverage: punct.coverage });
      setStatus(
        punct.applied
          ? 'Preview ready for this file. Apply writes punctuation only on the green stretch.'
          : 'No overlap in this file — the parallel does not match this juan. Nothing will be changed.',
      );
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : String(previewError));
    } finally {
      setBusy(false);
    }
  };

  const applyEditor = async () => {
    if (!editorPreview?.coverage || editorPreview.coverage.empty) {
      setError('Nothing to apply (empty coverage).');
      return;
    }
    const filePath = window.__leafWriterProject?.getActiveFilePath?.();
    let next = replaceJuanDiv(editorPreview.xml, editorPreview.body);
    next = appendTeiRevisionChange(next, formatParallelProvenance(sources, alignMode));
    if (!xmlLooksWellFormed(next)) {
      setError('Resulting XML is not well-formed.');
      return;
    }
    if (filePath && window.electronAPI?.writeFile) {
      await window.electronAPI.writeFile(filePath, next);
      await window.__leafWriterProject?.reloadFileFromDisk?.(filePath);
    } else if (window.writer?.setDocument) {
      window.writer.setDocument(next);
    } else {
      setError('Could not write the active document.');
      return;
    }
    setStampCoverage(editorPreview.coverage);
    setStatus('Applied parallel punctuation to the open file.');
  };

  const hint = useMemo(() => {
    if (punctuateOnly) {
      return 'Parallel punctuation applies to the open file only. Add a ctext wiki URL, Wikisource page, file, or paste (segmented mode for 李善 commentary).';
    }
    if (!projectReady) return 'Open a project first (same as Import Documents).';
    if (punctMode === 'parallel') {
      if (isPluginEnabled(DAOZANG_PLUGIN_ID)) {
        return 'Search by Kanripo id (KR…) or title. For Dao works (KR5…), a bundled Daozang match loads automatically when available. You can also paste a Wikisource work index (e.g. 荀子) and Fetch URL.';
      }
      return 'Search by Kanripo id (KR…) or title. Paste a Wikisource work index (e.g. 荀子) — Fetch URL loads every chapter page (勸學篇, …) and matches each juan on import.';
    }
    return 'Search by Kanripo id (KR…) or title. Each juan becomes one TEI file.';
  }, [projectReady, punctuateOnly, punctMode]);

  const shownEditorCoverage = editorPreview?.coverage ?? stampCoverage;

  const parallelPanel = (punctMode === 'parallel' || punctuateOnly) && (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2">Parallel transcription</Typography>
      {!punctuateOnly && isPluginEnabled(DAOZANG_PLUGIN_ID) && punctMode === 'parallel' && (
        <>
          {daozangMatch ? (
            <Alert severity="info" sx={{ mb: 1 }}>
              Bundled Daozang match ({daozangMatch.dzId}): {daozangMatch.title}
              {daozangMatch.matchMethod &&
              !['exact', 'duren_jing_index', 'override'].includes(daozangMatch.matchMethod)
                ? ` · via ${daozangMatch.matchMethod}`
                : ''}
            </Alert>
          ) : (
            selected?.id.startsWith('KR5') && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No bundled Daozang match for {selected.id}. Add Wikisource, a file, or paste below.
              </Typography>
            )
          )}
          {selected && (
            <Button
              size="small"
              variant="text"
              disabled={busy}
              sx={{ mb: 1 }}
              onClick={() => void applyBundledDaozangParallel(selected.id)}
            >
              Reload bundled Daozang match
            </Button>
          )}
        </>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {punctuateOnly
          ? 'Applies to the currently open file only. Use a ctext wiki URL for 李善 commentary (segmented mode), or a single Wikisource 卷 page / file / paste.'
          : 'On import, Fetch URL on a Wikisource work index loads all linked chapter pages (or 卷 pages for scanned editions) as one parallel tape.'}{' '}
        {punctuateOnly &&
          isCtextWikiUrl(ctextUrl) &&
          (isCtextWikiResUrl(ctextUrl)
            ? 'A res= index lists chapters — use List ctext sections, then click a chapter to fetch it.'
            : 'Narrow with section/contains below if the chapter page is long.')}
      </Typography>
      {punctuateOnly && (
        <FormControl sx={{ mb: 2 }} disabled={busy}>
          <FormLabel>Alignment mode</FormLabel>
          <RadioGroup
            value={alignMode}
            onChange={(event) => setAlignMode(event.target.value as ParallelAlignMode)}
          >
            <FormControlLabel
              value="segmented"
              control={<Radio />}
              label="Segmented (basetext + commentary separately — for ctext)"
            />
            <FormControlLabel
              value="tape"
              control={<Radio />}
              label="Single tape (one contiguous Han string)"
            />
          </RadioGroup>
        </FormControl>
      )}
      <Typography variant="body2" sx={{ mb: 1 }}>
        {punctuateOnly
          ? 'Parallel URL (ctext wiki, Wikisource, or other)'
          : 'Parallel URL (Wikisource or other)'}
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="URL"
        placeholder={
          punctuateOnly
            ? 'https://ctext.org/wiki.pl?chapter=… or https://zh.wikisource.org/wiki/…/卷01'
            : 'https://zh.wikisource.org/zh-hant/荀子 or …/wiki/荀子/勸學篇'
        }
        value={ctextUrl}
        onChange={(event) => setCtextUrl(event.target.value)}
        disabled={busy}
        sx={{ mb: 1 }}
      />
      {punctuateOnly && isCtextWikiUrl(ctextUrl) && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Section (ctext)"
            placeholder="兩都賦序"
            value={ctextSection}
            onChange={(event) => setCtextSection(event.target.value)}
            disabled={busy}
            sx={{ flex: 1, minWidth: 160 }}
          />
          <TextField
            size="small"
            label="Contains (ctext)"
            placeholder="或曰"
            value={ctextContains}
            onChange={(event) => setCtextContains(event.target.value)}
            disabled={busy}
            sx={{ flex: 1, minWidth: 160 }}
          />
        </Box>
      )}
      <Button
        size="small"
        variant="outlined"
        disabled={busy || !ctextUrl.trim()}
        sx={{ mb: 1, mr: 1 }}
        onClick={() => void fetchParallelUrl()}
      >
        Fetch URL
      </Button>
      {punctuateOnly && isCtextWikiUrl(ctextUrl) && (
        <Button
          size="small"
          variant="text"
          disabled={busy || !ctextUrl.trim()}
          sx={{ mb: 1 }}
          onClick={() => void listCtextSections()}
        >
          List ctext sections
        </Button>
      )}
      {!punctuateOnly && isWikisourceUrl(ctextUrl) && (
        <Button
          size="small"
          variant="text"
          disabled={busy || !ctextUrl.trim()}
          sx={{ mb: 1 }}
          onClick={() => void listWikisourceVolumes()}
        >
          List Wikisource 卷
        </Button>
      )}
      {isCtextWikiUrl(ctextUrl) && ctextSections.length > 0 && punctuateOnly && (
        <List dense sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          {ctextSections.map((section) => (
            <ListItemButton
              key={section.id}
              disabled={busy}
              onClick={() => {
                if (section.rowCount === 0 && isCtextWikiResUrl(ctextUrl)) {
                  const chapterUrl = ctextChapterUrlFromIndex(ctextUrl, section.id);
                  if (chapterUrl) void fetchParallelUrl(chapterUrl);
                  return;
                }
                setCtextSection(section.title || section.slug);
              }}
            >
              <ListItemText
                primary={section.title || section.slug}
                secondary={
                  section.rowCount === 0 && isCtextWikiResUrl(ctextUrl)
                    ? `chapter ${section.id} · click to fetch`
                    : `${section.rowCount} rows · ${section.id}`
                }
              />
            </ListItemButton>
          ))}
        </List>
      )}
      {!punctuateOnly && isWikisourceUrl(ctextUrl) && ctextSections.length > 0 && (
        <List dense sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          {ctextSections.map((section) => (
            <ListItem key={section.id} dense>
              <ListItemText
                primary={section.title || section.slug}
                secondary={`included in whole-edition fetch · ${section.id}`}
              />
            </ListItem>
          ))}
        </List>
      )}
      <Button
        size="small"
        variant="outlined"
        disabled={busy}
        sx={{ mb: 1, mr: 1 }}
        onClick={() => void addFiles()}
      >
        Add file…
      </Button>
      <TextField
        fullWidth
        multiline
        minRows={3}
        label="Paste punctuated text"
        value={pasteDraft}
        onChange={(event) => setPasteDraft(event.target.value)}
        disabled={busy}
      />
      <Button
        size="small"
        sx={{ mt: 1 }}
        disabled={busy || !pasteDraft.trim()}
        onClick={addPasteSource}
      >
        Add paste
      </Button>
      {sources.length > 0 && (
        <List dense sx={{ mt: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          {sources.map((source) => (
            <ListItem
              key={source.id}
              disablePadding
              secondaryAction={
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    setSources((current) => current.filter((item) => item.id !== source.id))
                  }
                >
                  Remove
                </Button>
              }
            >
              <ListItemText
                sx={{ pl: 2, pr: 10 }}
                primary={source.label}
                secondary={`${source.text.trim().length} characters${
                  source.kind && source.kind !== 'file' && source.kind !== 'paste'
                    ? ` · ${source.kind}`
                    : ''
                }`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={busy ? undefined : () => onClose?.('cancel')}
    >
      <DialogTitle>{punctuateOnly ? 'Segment and punctuate' : 'Import from Kanripo'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {hint}
        </Typography>
        {!punctuateOnly && (
          <>
            <TextField
              autoFocus
              fullWidth
              label="Search works"
              placeholder="KR1a0145 or 周易"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={busy}
            />
            <List
              dense
              sx={{
                maxHeight: 240,
                overflow: 'auto',
                mt: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {hits.map((hit) => (
                <ListItemButton
                  key={hit.id}
                  selected={selected?.id === hit.id}
                  disabled={busy}
                  onClick={() => setSelected(hit)}
                >
                  <ListItemText
                    primary={`${hit.id}  ${hit.title}`}
                    secondary={secondaryFor(hit) || undefined}
                  />
                </ListItemButton>
              ))}
              {hits.length === 0 && (
                <Box sx={{ px: 2, py: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    No matches.
                  </Typography>
                </Box>
              )}
            </List>
            <FormControl sx={{ mt: 2 }} disabled={busy}>
              <FormLabel>Character normalisation</FormLabel>
              <RadioGroup
                value={normalize}
                onChange={(event) => setNormalize(event.target.value as KanripoNormalizeMode)}
              >
                <FormControlLabel
                  value="off"
                  control={<Radio />}
                  label="As in Kanripo (no table)"
                />
                <FormControlLabel
                  value="dpm"
                  control={<Radio />}
                  label="DPM variant table (bundled with plugin)"
                />
                <FormControlLabel
                  value="hard_replacements"
                  control={<Radio />}
                  label="Hard replacements (simp → trad)"
                />
              </RadioGroup>
            </FormControl>
            <FormControl sx={{ mt: 2 }} disabled={busy}>
              <FormLabel>Punctuation</FormLabel>
              <RadioGroup
                value={punctMode}
                onChange={(event) => {
                  const next = event.target.value as 'as-is' | 'parallel';
                  setPunctMode(next);
                  if (next === 'parallel') setAlignMode(punctuateOnly ? 'segmented' : 'tape');
                }}
              >
                <FormControlLabel
                  value="as-is"
                  control={<Radio />}
                  label="As-is (pilcrow join only)"
                />
                <FormControlLabel
                  value="parallel"
                  control={<Radio />}
                  label="From a parallel transcription"
                />
                <FormControlLabel
                  value="ai"
                  control={<Radio />}
                  label="AI (not in this version)"
                  disabled
                />
              </RadioGroup>
            </FormControl>
          </>
        )}
        {parallelPanel}
        {punctuateOnly && shownEditorCoverage && (
          <CoverageBar coverage={shownEditorCoverage} label="This juan" />
        )}
        {report?.bars?.map((bar) => (
          <CoverageBar key={bar.stem} coverage={bar.coverage} label={bar.stem} />
        ))}
        {busy && <LinearProgress sx={{ mt: 2 }} />}
        {status && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {status}
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {report && (
          <Alert severity={report.failed.length ? 'warning' : 'success'} sx={{ mt: 2 }}>
            Written: {report.written.length}. Failed: {report.failed.length}.
            {report.failed.length > 0 && (
              <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                {report.failed.map((item) => (
                  <li key={item.stem}>
                    {item.stem}: {item.message}
                  </li>
                ))}
              </Box>
            )}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => onClose?.('cancel')}>
          Close
        </Button>
        {punctuateOnly ? (
          <>
            <Button disabled={busy || !hasSources} onClick={() => void previewEditor()}>
              Preview
            </Button>
            <Button
              variant="contained"
              disabled={busy || !editorPreview || editorPreview.coverage.empty}
              onClick={() => void applyEditor()}
            >
              Apply
            </Button>
          </>
        ) : (
          <Button variant="contained" disabled={!canRunImport} onClick={() => void runImport()}>
            Import
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export const isKanripoImportAvailable = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean(window.electronAPI?.kanripoClone) &&
  isPluginEnabled(PLUGIN_ID);
