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
import { ensureImportHeaderEntitiesForPaths } from '../../../../../apps/commons/src/desktop/ensureImportHeaderEntities';
import type { IDialog } from '../type';
import { isPluginEnabled } from '../../plugins';

const PLUGIN_ID = 'bdrc-import';

interface BdrcInspect {
  utId: string;
  veId?: string | null;
  from?: 'ut' | 've';
  title: string;
  titleLang?: string;
  access: string | null;
  status: string | null;
  restricted: boolean;
  unsupported?: boolean;
  workId: string | null;
  instanceId: string | null;
  imageGroupId: string | null;
  paginated: boolean;
  bampoCount?: number;
}

interface BdrcImportResult {
  restricted: boolean;
  unsupported?: boolean;
  warnings: string[];
  fromCache: boolean;
  split?: boolean;
  partCount: number;
  meta: { utId: string; instanceId?: string; workId?: string };
  written: string[];
  pbCount: number;
}

export interface BdrcImportDialogProps extends IDialog {
  /** etext id, `VE…` volume id, or library.bdrc.io reader URL — from the extension. */
  initialRef?: string;
  /** Run the import immediately and close on success (browser-extension one-click path). */
  autoRun?: boolean;
}

export const BdrcImportDialog = ({
  onClose,
  open = false,
  initialRef = '',
  autoRun = false,
}: BdrcImportDialogProps) => {
  const [ref, setRef] = useState(initialRef);
  const [inspect, setInspect] = useState<BdrcInspect | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [split, setSplit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const projectReady = Boolean(window.__leafWriterProject?.isProjectReady?.());

  const runInspect = useCallback(
    async (override?: string): Promise<BdrcInspect | null> => {
      const api = window.electronAPI;
      if (!api?.bdrcInspect) {
        setError('BDRC import is only available in the desktop app.');
        return null;
      }
      const target = (override ?? ref).trim();
      if (!target) return null;
      setBusy(true);
      setError(null);
      setStatus('');
      setInspect(null);
      try {
        const next = (await api.bdrcInspect(target)) as BdrcInspect;
        setInspect(next);
        if (next.unsupported) {
          setStatus(
            'No downloadable transcription for this volume — BDRC serves OpenPecha / pecha.org texts differently.',
          );
        } else if (next.restricted) {
          setStatus(`${next.utId}: access ${next.access ?? 'unknown'} — text is not retrievable.`);
        }
        return next;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [ref],
  );

  const importToFile = useCallback(
    async (refValue: string, force: boolean, splitByBampo: boolean): Promise<boolean> => {
      const api = window.electronAPI;
      const project = window.__leafWriterProject;
      const rootPath = project?.getProjectRootPath?.();
      if (!project || !project.isProjectReady?.() || !rootPath) {
        setError('Open a project before importing from BDRC.');
        return false;
      }
      if (!api?.bdrcImportToProject) {
        setError('BDRC import is only available in the desktop app.');
        return false;
      }

      setBusy(true);
      setError(null);
      setStatus(`Fetching ${refValue}…`);

      try {
        const result = (await api.bdrcImportToProject(refValue.trim(), {
          projectRoot: rootPath,
          forceRefresh: force,
          split: splitByBampo,
        })) as unknown as BdrcImportResult;
        if (result.unsupported) {
          throw new Error(
            'No downloadable transcription for this volume — BDRC serves OpenPecha / pecha.org texts differently, and this importer can’t fetch them.',
          );
        }
        if (result.restricted) {
          throw new Error('BDRC does not release this text for download.');
        }
        if (!result.written?.length) throw new Error('BDRC returned no text.');

        await ensureImportHeaderEntitiesForPaths(result.written);
        await project.refreshExplorer?.();
        await project.openFile?.(result.written[0]);
        const warn = result.warnings?.length
          ? ` ${result.warnings.length} warning(s) — see console.`
          : '';
        const src = result.fromCache ? ' (from local cache)' : '';
        const fileWord = result.written.length === 1 ? 'file' : 'files';
        const sourceHint =
          result.pbCount >= 30
            ? ' Opened in Source mode — this volume has many page/line breaks.'
            : '';
        setStatus(
          `Imported ${result.meta.utId} — ${result.written.length} ${fileWord}, ${result.pbCount} folios${src}.${sourceHint}${warn}`,
        );
        if (result.warnings?.length) console.warn('[bdrc-import]', result.warnings);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const runImport = () => void importToFile(ref.trim(), refresh, split);

  // Opened from the browser extension: pre-fill, inspect, and — when `autoRun`
  // — import straight away and close, so it's one click in the popup.
  const autoHandled = useRef('');
  useEffect(() => {
    if (!open || !initialRef || autoHandled.current === initialRef) return;
    autoHandled.current = initialRef;
    setRef(initialRef);
    void (async () => {
      const insp = await runInspect(initialRef);
      if (
        autoRun &&
        insp &&
        !insp.restricted &&
        !insp.unsupported &&
        window.__leafWriterProject?.isProjectReady?.()
      ) {
        const ok = await importToFile(initialRef, false, split);
        if (ok) onClose?.();
      }
    })();
  }, [open, initialRef, autoRun, runInspect, importToFile, onClose, split]);

  const canImport = Boolean(
    ref.trim() &&
    projectReady &&
    !busy &&
    (!inspect || (!inspect.restricted && !inspect.unsupported)),
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
          import pulls the whole <strong>volume</strong> you have open in BUDA (not all 103 Kangyur
          volumes at once). With “Split into bam po” on, BDRC’s fascicles become separate files.
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
            {!inspect.unsupported && (
              <Typography variant="caption" component="div" color="text.secondary">
                access {inspect.access ?? 'unknown'} · status {inspect.status ?? 'unknown'}
                {inspect.bampoCount != null && inspect.bampoCount >= 2
                  ? ` · ${inspect.bampoCount} bam po (fascicles) in this volume`
                  : ''}
              </Typography>
            )}
            {inspect.unsupported ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                No downloadable transcription for this volume. BDRC serves OpenPecha / pecha.org
                texts differently, and this importer can’t fetch them.
              </Alert>
            ) : (
              inspect.restricted && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  BDRC does not release this text for download. Open it in the BUDA reader instead.
                </Alert>
              )
            )}
          </Box>
        )}

        <FormControlLabel
          sx={{ mt: 1, display: 'block' }}
          control={
            <Switch
              size="small"
              checked={split}
              disabled={busy}
              onChange={(e) => setSplit(e.target.checked)}
            />
          }
          label={
            <Typography variant="caption">
              Split into one file per bam po (fascicle)
              {inspect?.bampoCount != null && inspect.bampoCount >= 2
                ? ` — ${inspect.bampoCount} files`
                : ''}
            </Typography>
          }
        />
        <FormControlLabel
          sx={{ mt: 0.5, display: 'block' }}
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

export const isBdrcImportAvailable = (): boolean =>
  Boolean(window.electronAPI?.bdrcImportToProject ?? window.electronAPI?.bdrcImport);
