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
  ListItemButton,
  ListItemText,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  uniqueKanripoXmlPath,
  wrapKanripoTeiDocument,
  type KanripoNormalizeMode,
  type KanripoTeiMeta,
} from '../../../../../apps/commons/src/desktop/kanripoImportXml';
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

export const KanripoImportDialog = ({ onClose, open = false }: IDialog) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<KanripoWorkHit[]>([]);
  const [selected, setSelected] = useState<KanripoWorkHit | null>(null);
  const [normalize, setNormalize] = useState<KanripoNormalizeMode>('off');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ written: string[]; failed: { stem: string; message: string }[] } | null>(
    null,
  );

  const projectReady = Boolean(window.__leafWriterProject?.isProjectReady?.());

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
    if (!open) return;
    void search('');
  }, [open, search]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void search(query);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [open, query, search]);

  const secondaryFor = (hit: KanripoWorkHit) =>
    [hit.author, hit.dynasty].filter(Boolean).join(' · ');

  const canRun = Boolean(selected && projectReady && !busy && window.electronAPI?.kanripoClone);

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
          const xml = wrapKanripoTeiDocument({
            config,
            meta: { ...converted.meta, normalize, stem: converted.meta.stem || stem },
            bodyXml: converted.body_xml,
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
      setReport({ written, failed });
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

  const hint = useMemo(() => {
    if (!projectReady) return 'Open a project first (same as Import Documents).';
    return 'Search by Kanripo id (KR…) or title. Each juan becomes one TEI file.';
  }, [projectReady]);

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={busy ? undefined : () => onClose?.('cancel')}
    >
      <DialogTitle>Import from Kanripo</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {hint}
        </Typography>
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Punctuation: as-is only (parallel punctuation is not in this version).
        </Typography>
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
        <Button variant="contained" disabled={!canRun} onClick={() => void runImport()}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const isKanripoImportAvailable = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean(window.electronAPI?.kanripoClone) &&
  isPluginEnabled(PLUGIN_ID);
