import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  uniqueBdrcXmlPath,
  wrapBdrcTeiDocument,
  type BdrcHeaderFields,
} from '../../../../../apps/commons/src/desktop/bdrcImportXml';
import type { IDialog } from '../type';
import { isPluginEnabled } from '../../plugins';

const PLUGIN_ID = 'bdrc-import';

interface BdrcInspect {
  utId: string;
  title: string;
  titleLang?: string;
  access: string | null;
  status: string | null;
  restricted: boolean;
  workId: string | null;
  instanceId: string | null;
  imageGroupId: string | null;
  paginated: boolean;
}

interface BdrcImportResult {
  restricted: boolean;
  warnings: string[];
  fromCache: boolean;
  meta: { utId: string; instanceId?: string; workId?: string };
  bodyXml: string;
  headerFields: BdrcHeaderFields;
  pbCount: number;
  structure: 'flat' | 'outline';
}

export interface BdrcImportDialogProps extends IDialog {
  /** etext id, `VE…` volume id, or library.bdrc.io reader URL — from the extension. */
  initialRef?: string;
}

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/+/g, '/');
const parentDir = (filePath: string): string => {
  const n = filePath.replace(/\\/g, '/');
  const i = n.lastIndexOf('/');
  return i === -1 ? '' : n.slice(0, i);
};
const xmlLooksWellFormed = (xml: string): boolean => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return !doc.querySelector('parsererror');
};

export const BdrcImportDialog = ({
  onClose,
  open = false,
  initialRef = '',
}: BdrcImportDialogProps) => {
  const [ref, setRef] = useState(initialRef);
  const [inspect, setInspect] = useState<BdrcInspect | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const projectReady = Boolean(window.__leafWriterProject?.isProjectReady?.());

  const runInspect = useCallback(
    async (override?: string) => {
      const api = window.electronAPI;
      if (!api?.bdrcInspect) {
        setError('BDRC import is only available in the desktop app.');
        return;
      }
      const target = (override ?? ref).trim();
      if (!target) return;
      setBusy(true);
      setError(null);
      setStatus('');
      setInspect(null);
      try {
        const next = (await api.bdrcInspect(target)) as BdrcInspect;
        setInspect(next);
        if (next.restricted) {
          setStatus(`${next.utId}: access ${next.access ?? 'unknown'} — text is not retrievable.`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [ref],
  );

  // Pre-fill and auto-inspect when opened from the browser extension.
  const autoInspected = useRef('');
  useEffect(() => {
    if (!open || !initialRef || autoInspected.current === initialRef) return;
    autoInspected.current = initialRef;
    setRef(initialRef);
    void runInspect(initialRef);
  }, [open, initialRef, runInspect]);

  const runImport = async () => {
    const api = window.electronAPI;
    const project = window.__leafWriterProject;
    const rootPath = project?.getProjectRootPath?.();
    const config = project?.getProjectConfig?.();
    if (!project || !projectReady || !rootPath || !config) {
      setError('Open a project before importing from BDRC.');
      return;
    }
    if (!api?.bdrcImport || !api.writeFile || !api.ensureDirectory) {
      setError('BDRC import is only available in the desktop app.');
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(`Fetching ${inspect?.utId ?? ref.trim()}…`);

    try {
      const result = (await api.bdrcImport(ref.trim(), {
        forceRefresh: refresh,
      })) as unknown as BdrcImportResult;
      if (result.restricted) {
        throw new Error(
          `Access tier ${result.headerFields.accessTier ?? 'unknown'} — BDRC does not release this text for download.`,
        );
      }
      if (!result.bodyXml) throw new Error('BDRC returned no text.');

      const xml = wrapBdrcTeiDocument({
        config,
        headerFields: result.headerFields,
        bodyXml: result.bodyXml,
      });
      if (!xmlLooksWellFormed(xml)) throw new Error('Wrapped TEI is not well-formed XML.');

      const instance = result.meta.instanceId || result.meta.workId || 'work';
      const destDir = joinPath(rootPath, 'imported', 'bdrc', instance);
      await api.ensureDirectory(destDir);
      const used = new Set<string>();
      for (const entry of (await api.readDirectory?.(destDir, { allFiles: true })) ?? []) {
        if (!entry.isDirectory && entry.name.toLowerCase().endsWith('.xml')) {
          used.add(joinPath(destDir, entry.name).replace(/\\/g, '/'));
        }
      }
      const outputPath = uniqueBdrcXmlPath(destDir, result.meta.utId, used);
      const dir = parentDir(outputPath);
      if (dir) await api.ensureDirectory(dir);
      await api.writeFile(outputPath, xml);

      await project.refreshExplorer?.();
      await project.openFile?.(outputPath);
      const warn = result.warnings?.length
        ? ` ${result.warnings.length} warning(s) — see console.`
        : '';
      const src = result.fromCache ? ' (from local cache)' : '';
      setStatus(`Imported ${result.meta.utId} (${result.pbCount} folios)${src}.${warn}`);
      if (result.warnings?.length) console.warn('[bdrc-import]', result.warnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const canImport = Boolean(
    ref.trim() && projectReady && !busy && (!inspect || !inspect.restricted),
  );

  return (
    <Dialog open={open} onClose={() => onClose?.()} maxWidth="sm" fullWidth>
      <DialogTitle>Import from BDRC</DialogTitle>
      <DialogContent>
        {!isPluginEnabled(PLUGIN_ID) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Enable the “BDRC import” plugin in Tools → Plugins.
          </Alert>
        )}

        <Typography variant="body2" sx={{ mb: 2 }}>
          Paste a BDRC etext id (<code>UT…</code>) or a purl.bdrc.io / library.bdrc.io URL. One
          import pulls the whole volume, with a page break per folio.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {busy && <LinearProgress sx={{ mb: 2 }} />}
        {status && (
          <Typography variant="caption" sx={{ mb: 2, display: 'block' }}>
            {status}
          </Typography>
        )}

        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Etext id or BDRC URL"
            placeholder="UT4CZ5369_I1KG9127_0000"
            value={ref}
            disabled={busy}
            onChange={(e) => setRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runInspect();
            }}
          />
          <Button onClick={() => void runInspect()} disabled={!ref.trim() || busy}>
            Inspect
          </Button>
        </Stack>

        {inspect && (
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}>
            <Typography variant="subtitle2">{inspect.title || inspect.utId}</Typography>
            <Typography variant="caption" component="div" color="text.secondary">
              {inspect.utId}
              {inspect.workId ? ` · work ${inspect.workId}` : ''}
              {inspect.instanceId ? ` · instance ${inspect.instanceId}` : ''}
            </Typography>
            <Typography variant="caption" component="div" color="text.secondary">
              access {inspect.access ?? 'unknown'} · status {inspect.status ?? 'unknown'}
            </Typography>
            {inspect.restricted && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                BDRC does not release this text for download. Open it in the BUDA reader instead.
              </Alert>
            )}
          </Box>
        )}

        <FormControlLabel
          sx={{ mt: 1 }}
          control={
            <Switch
              size="small"
              checked={refresh}
              disabled={busy}
              onChange={(e) => setRefresh(e.target.checked)}
            />
          }
          label={
            <Typography variant="caption">Re-fetch from BDRC (ignore the local cache)</Typography>
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose?.()}>Close</Button>
        <Button variant="contained" disabled={!canImport} onClick={() => void runImport()}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const isBdrcImportAvailable = (): boolean => Boolean(window.electronAPI?.bdrcImport);
