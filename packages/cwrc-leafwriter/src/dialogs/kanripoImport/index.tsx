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
import type { IDialog } from '../type';
import { isPluginEnabled } from '../../plugins';

const PLUGIN_ID = 'kanripo-import';

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
}

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
  const [punctMode, setPunctMode] = useState<'as-is' | 'parallel'>(punctuateOnly ? 'parallel' : 'as-is');
  const [sources, setSources] = useState<ParallelSource[]>([]);
  const [pasteDraft, setPasteDraft] = useState('');
  const [pasteCount, setPasteCount] = useState(0);
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

  const secondaryFor = (hit: KanripoWorkHit) =>
    [hit.author, hit.dynasty].filter(Boolean).join(' · ');

  const invokeParallel = async (bodyXml: string): Promise<ParallelPunctPayload> => {
    const api = window.electronAPI;
    if (!api?.pluginsInvokePython) throw new Error('Python bridge unavailable.');
    return (await api.pluginsInvokePython(PLUGIN_ID, {
      op: 'parallel_punct',
      body_xml: bodyXml,
      sources: sources.map((source) => ({
        id: source.id,
        label: source.label,
        text: source.text,
      })),
    })) as ParallelPunctPayload;
  };

  const addPasteSource = () => {
    const text = pasteDraft.trim();
    if (!text) return;
    const next = pasteCount + 1;
    setPasteCount(next);
    setSources((current) => [
      ...current,
      { id: `paste-${next}`, label: `Paste ${next}`, text },
    ]);
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
    if (!projectReady || !rootPath || !config) {
      setError('Open a project before importing from Kanripo.');
      return;
    }
    const api = window.electronAPI;
    if (!api?.kanripoClone || !api.pluginsInvokePython || !api.writeFile || !api.ensureDirectory) {
      setError('Kanripo import is only available in the desktop app.');
      return;
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
        const stem = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.txt$/i, '') ?? 'juan';
        setStatus(`Converting ${stem} (${i + 1} of ${files.length})…`);
        try {
          const converted = (await api.pluginsInvokePython(PLUGIN_ID, {
            path: filePath,
            normalize,
          })) as ConvertPayload;
          if (!converted?.body_xml || !converted.meta) {
            throw new Error('Python conversion returned no TEI body.');
          }
          let bodyXml = converted.body_xml;
          let punctNote: string | undefined;
          if (punctMode === 'parallel') {
            const punct = await invokeParallel(bodyXml);
            bars.push({ stem, coverage: punct.coverage });
            if (punct.applied) {
              bodyXml = punct.body_xml;
              punctNote = 'parallel punctuation on overlapping stretch';
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
          ? 'Preview ready. Apply writes punctuation only on the green stretch.'
          : 'No overlap — the parallel does not match this juan. Nothing will be changed.',
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
    const next = replaceJuanDiv(editorPreview.xml, editorPreview.body);
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
    setStatus('Applied parallel punctuation on the overlapping stretch.');
  };

  const hint = useMemo(() => {
    if (punctuateOnly) {
      return 'Add punctuated parallels (file or paste). Grey = unmatched; green = punctuation that will be copied. Existing stamps show on the bar even before you add a source.';
    }
    if (!projectReady) return 'Open a project first (same as Import Documents).';
    return 'Search by Kanripo id (KR…) or title. Each juan becomes one TEI file.';
  }, [projectReady, punctuateOnly]);

  const shownEditorCoverage = editorPreview?.coverage ?? stampCoverage;

  const parallelPanel = (punctMode === 'parallel' || punctuateOnly) && (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2">Parallel transcription</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Add one or more files or pastes. URL / Wikisource is a later step. Punctuation is copied only
        where the texts overlap.
      </Typography>
      <Button size="small" variant="outlined" disabled={busy} sx={{ mb: 1, mr: 1 }} onClick={() => void addFiles()}>
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
                  onClick={() => setSources((current) => current.filter((item) => item.id !== source.id))}
                >
                  Remove
                </Button>
              }
            >
              <ListItemText
                sx={{ pl: 2, pr: 10 }}
                primary={source.label}
                secondary={`${source.text.trim().length} characters`}
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
            <List dense sx={{ maxHeight: 240, overflow: 'auto', mt: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {hits.map((hit) => (
                <ListItemButton
                  key={hit.id}
                  selected={selected?.id === hit.id}
                  disabled={busy}
                  onClick={() => setSelected(hit)}
                >
                  <ListItemText primary={`${hit.id}  ${hit.title}`} secondary={secondaryFor(hit) || undefined} />
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
                <FormControlLabel value="off" control={<Radio />} label="As in Kanripo (no table)" />
                <FormControlLabel value="dpm" control={<Radio />} label="DPM table (normalization_zh)" />
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
                onChange={(event) => setPunctMode(event.target.value as 'as-is' | 'parallel')}
              >
                <FormControlLabel value="as-is" control={<Radio />} label="As-is (pilcrow join only)" />
                <FormControlLabel value="parallel" control={<Radio />} label="From a parallel transcription" />
                <FormControlLabel value="ai" control={<Radio />} label="AI (not in this version)" disabled />
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
