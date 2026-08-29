import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
  uniqueDaozangXmlPath,
  wrapDaozangTeiDocument,
  type DaozangTeiMeta,
} from '../../../../../apps/commons/src/desktop/daozangImportXml';
import type { IDialog } from '../type';
import { isPluginEnabled } from '../../plugins';

const PLUGIN_ID = 'daozang-import';

interface DaozangWorkHit {
  id: string;
  dz_no: string;
  title: string;
  variant: string;
  rel_path: string;
}

interface DaozangStatus {
  ready: boolean;
  textCount: number;
  source?: 'user-cache' | 'bundled' | 'none';
  manifest?: {
    syncedAt?: string;
    transcriber?: string;
  };
}

interface ConvertPayload {
  meta: DaozangTeiMeta;
  body_xml: string;
  split?: boolean;
  juan_files?: {
    juan_n: string;
    juan_title: string;
    subtitle?: string;
    body_xml: string;
  }[];
}

export type DaozangImportDialogProps = IDialog;

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

export const DaozangImportDialog = ({ onClose, open = false }: DaozangImportDialogProps) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<DaozangWorkHit[]>([]);
  const [selected, setSelected] = useState<DaozangWorkHit | null>(null);
  const [statusInfo, setStatusInfo] = useState<DaozangStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ written: string[] } | null>(null);
  const [localSources, setLocalSources] = useState<
    { path: string; label: string; kind: 'extracted' | 'rar' }[]
  >([]);

  const projectReady = Boolean(window.__leafWriterProject?.isProjectReady?.());

  const refreshStatus = useCallback(async () => {
    const api = window.electronAPI?.daozangStatus;
    if (!api) return;
    const next = await api();
    setStatusInfo(next);
    return next;
  }, []);

  const search = useCallback(async (text: string) => {
    const api = window.electronAPI?.daozangSearch;
    if (!api) return;
    const next = await api(text);
    setHits(next);
    setSelected((current) => {
      if (current && next.some((hit) => hit.rel_path === current.rel_path)) return current;
      return next[0] ?? null;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    void window.electronAPI?.daozangDetectLocalSources?.().then((paths) => {
      setLocalSources(paths ?? []);
    });
    void refreshStatus().then((info) => {
      if (info?.ready) void search('');
    });
  }, [open, refreshStatus, search]);

  useEffect(() => {
    if (!open || !statusInfo?.ready) return;
    const handle = window.setTimeout(() => {
      void search(query);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [open, query, search, statusInfo?.ready]);

  const installFromSource = async (sourcePath: string) => {
    const api = window.electronAPI?.daozangInstallFromSource;
    if (!api) {
      setError('Corpus install is only available in the desktop app.');
      return;
    }
    setBusy(true);
    setError(null);
    setReport(null);
    setStatus('Installing corpus from local file…');
    try {
      const result = await api(sourcePath);
      await refreshStatus();
      await search('');
      setStatus(`Corpus ready: ${result.textCount ?? 0} texts converted to UTF-8.`);
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : String(installError));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const pickCorpusSource = async () => {
    const picked = await window.electronAPI?.daozangPickCorpusSource?.();
    if (!picked) return;
    await installFromSource(picked);
  };

  const rebuildCorpus = async (force: boolean) => {
    const api = window.electronAPI?.daozangSync;
    if (!api) {
      setError('Corpus rebuild is only available in the desktop app.');
      return;
    }
    setBusy(true);
    setError(null);
    setReport(null);
    setStatus(force ? 'Rebuilding from cached RAR…' : 'Refreshing search index…');
    try {
      const result = await api({ force });
      await refreshStatus();
      await search('');
      setStatus(
        result.reused
          ? `Local corpus ready (${result.textCount} texts).`
          : `Rebuilt local corpus (${result.textCount} texts).`,
      );
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : String(syncError));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!selected) return;
    const project = window.__leafWriterProject;
    const rootPath = project?.getProjectRootPath?.();
    const config = project?.getProjectConfig?.();
    if (!project || !projectReady || !rootPath || !config) {
      setError('Open a project before importing from the Daozang corpus.');
      return;
    }
    const api = window.electronAPI;
    if (
      !api?.pluginsInvokePython ||
      !api.writeFile ||
      !api.ensureDirectory ||
      !api.daozangResolveText
    ) {
      setError('Daozang import is only available in the desktop app.');
      return;
    }

    setBusy(true);
    setError(null);
    setReport(null);
    setStatus(`Importing ${selected.title}…`);

    try {
      const sourcePath = await api.daozangResolveText(selected.rel_path);
      const converted = (await api.pluginsInvokePython(PLUGIN_ID, {
        path: sourcePath,
        rel_path: selected.rel_path,
      })) as ConvertPayload;
      if (!converted?.body_xml || !converted.meta) {
        throw new Error('Python conversion returned no TEI body.');
      }

      const destDir = joinPath(rootPath, 'imported', 'daozang');
      await api.ensureDirectory(destDir);
      const used = new Set<string>();
      const existingEntries = (await api.readDirectory?.(destDir, { allFiles: true })) ?? [];
      for (const entry of existingEntries) {
        if (!entry.isDirectory && entry.name.toLowerCase().endsWith('.xml')) {
          used.add(joinPath(destDir, entry.name).replace(/\\/g, '/'));
        }
      }

      const baseStem = converted.meta.stem || selected.title || selected.id;
      const juanFiles =
        converted.split && converted.juan_files && converted.juan_files.length >= 2
          ? converted.juan_files
          : [
              {
                juan_n: '',
                juan_title: converted.meta.title,
                body_xml: converted.body_xml,
              },
            ];

      const written: string[] = [];
      for (const juan of juanFiles) {
        const fileStem =
          juan.juan_n && juanFiles.length > 1
            ? `${baseStem}-卷${juan.juan_n}`
            : baseStem;
        const docTitle =
          juan.juan_n && juanFiles.length > 1
            ? `${converted.meta.title} — 卷${juan.juan_n}`
            : converted.meta.title;
        const xml = wrapDaozangTeiDocument({
          config,
          meta: { ...converted.meta, title: docTitle },
          bodyXml: juan.body_xml,
        });
        if (!xmlLooksWellFormed(xml)) {
          throw new Error('Wrapped TEI is not well-formed XML.');
        }
        const outputPath = uniqueDaozangXmlPath(destDir, fileStem, used);
        const dir = parentDir(outputPath);
        if (dir) await api.ensureDirectory(dir);
        await api.writeFile(outputPath, xml);
        written.push(outputPath);
      }

      await project.refreshExplorer?.();
      await project.openFile?.(written[0]);
      setReport({ written });
      setStatus(
        written.length > 1
          ? `Imported ${selected.title} as ${written.length} juan files.`
          : `Imported ${selected.title}.`,
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const canImport = Boolean(selected && projectReady && statusInfo?.ready && !busy);

  return (
    <Dialog open={open} onClose={() => onClose?.()} maxWidth="md" fullWidth>
      <DialogTitle>Import from Daozang</DialogTitle>
      <DialogContent>
        {!isPluginEnabled('daozang-import') && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Enable the “Daozang import” plugin in Tools → Plugins.
          </Alert>
        )}

        <Typography variant="body2" sx={{ mb: 2 }}>
          Search 方瞳子源 (Fang Tongzi) transcriptions. When the plugin is installed with its
          bundled corpus, no separate download is needed. You can still replace the cache from a
          local RAR or corpus pack if you prefer.
        </Typography>

        {statusInfo && (
          <Alert severity={statusInfo.ready ? 'success' : 'info'} sx={{ mb: 2 }}>
            {statusInfo.ready
              ? statusInfo.source === 'bundled'
                ? `Bundled corpus ready: ${statusInfo.textCount} texts (shipped with the plugin).`
                : `Local corpus ready: ${statusInfo.textCount} texts${
                    statusInfo.manifest?.syncedAt
                      ? ` (installed ${new Date(statusInfo.manifest.syncedAt).toLocaleString()})`
                      : ''
                  }.`
              : 'No corpus found. Reinstall the plugin with bundled data, or install from a local file.'}
          </Alert>
        )}

        {!statusInfo?.ready && localSources.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Found a local Fang Tongzi corpus in Downloads.
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {localSources.map((source) => (
                <Button
                  key={source.path}
                  size="small"
                  variant={source.kind === 'extracted' ? 'contained' : 'outlined'}
                  disabled={busy}
                  onClick={() => void installFromSource(source.path)}
                >
                  Install {source.label}
                </Button>
              ))}
            </Box>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {busy && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            {status && (
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                {status}
              </Typography>
            )}
          </Box>
        )}

        {!busy && status && (
          <Typography variant="caption" sx={{ mb: 2, display: 'block' }}>
            {status}
          </Typography>
        )}

        {report && report.written.length > 0 && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Wrote {report.written.length} file(s).
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" disabled={busy} onClick={() => void pickCorpusSource()}>
            Install corpus from file…
          </Button>
          <Button
            variant="outlined"
            disabled={busy || !statusInfo?.ready}
            onClick={() => void rebuildCorpus(false)}
          >
            Refresh index
          </Button>
          <Button
            variant="text"
            disabled={busy || !statusInfo?.ready}
            onClick={() => void rebuildCorpus(true)}
          >
            Rebuild from cached RAR
          </Button>
        </Box>

        <TextField
          fullWidth
          label="Search by title or 道藏 number"
          value={query}
          disabled={!statusInfo?.ready || busy}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ mb: 2 }}
        />

        <List dense sx={{ maxHeight: 320, overflow: 'auto', border: 1, borderColor: 'divider' }}>
          {hits.length === 0 && (
            <ListItem>
              <ListItemText
                primary={statusInfo?.ready ? 'No matches.' : 'Install the corpus to browse texts.'}
              />
            </ListItem>
          )}
          {hits.map((hit) => (
            <ListItemButton
              key={hit.rel_path}
              selected={selected?.rel_path === hit.rel_path}
              onClick={() => setSelected(hit)}
            >
              <ListItemText
                primary={hit.title}
                secondary={[hit.dz_no && `DZ ${hit.dz_no}`, hit.variant, hit.rel_path]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose?.()}>Close</Button>
        <Button variant="contained" disabled={!canImport} onClick={() => void runImport()}>
          Import selected
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const isDaozangImportAvailable = (): boolean =>
  Boolean(
    window.electronAPI?.daozangStatus &&
    window.electronAPI?.daozangInstallFromSource &&
    window.electronAPI?.daozangSearch &&
    window.electronAPI?.pluginsInvokePython,
  );
