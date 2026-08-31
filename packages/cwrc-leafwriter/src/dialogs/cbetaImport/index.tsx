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
  uniqueCbetaXmlPath,
  wrapCbetaTeiDocument,
  type CbetaTeiMeta,
} from '../../../../../apps/commons/src/desktop/cbetaImportXml';
import { CorpusWorkRow } from '../corpusWorkRow';
import type { IDialog } from '../type';
import { isPluginEnabled } from '../../plugins';

const PLUGIN_ID = 'cbeta-import';

interface CbetaWorkHit {
  work_id: string;
  title: string;
  canon: string;
  dynasty: string;
  category: string;
  juan_count: number;
}

interface CbetaCorpusStatus {
  present: boolean;
  path?: string;
  pinned_tag?: string;
  commit?: string;
}

interface CbetaJuan {
  n: string;
  title: string;
  body_xml: string;
  straddles?: string[];
  report?: Record<string, number>;
}

interface CbetaConvertPayload {
  work_id: string;
  canon: string;
  vol: string;
  no: string;
  data_version?: string;
  git_commit?: string;
  juan: CbetaJuan[];
  warnings?: string[];
  // filled by metadata_xml (planning §5.8): CBETA-header extraction + work_info.json
  title?: string;
  dynasty?: string;
  category?: string;
  taisho_vol?: string;
  taisho_no?: string;
  authorship?: CbetaTeiMeta['authorship'];
  work_qid?: string;
}

export type CbetaImportDialogProps = IDialog;

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/+/g, '/');
const parentDir = (filePath: string): string => {
  const n = filePath.replace(/\\/g, '/');
  const i = n.lastIndexOf('/');
  return i === -1 ? '' : n.slice(0, i);
};

const invokePython = async <T,>(payload: Record<string, unknown>): Promise<T> => {
  const api = window.electronAPI;
  if (!api?.pluginsInvokePython)
    throw new Error('CBETA import is only available in the desktop app.');
  return (await api.pluginsInvokePython(PLUGIN_ID, payload)) as T;
};

export const CbetaImportDialog = ({ onClose, open = false }: CbetaImportDialogProps) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CbetaWorkHit[]>([]);
  const [selected, setSelected] = useState<CbetaWorkHit | null>(null);
  const [corpus, setCorpus] = useState<CbetaCorpusStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const projectReady = Boolean(window.__leafWriterProject?.isProjectReady?.());

  const refreshStatus = useCallback(async () => {
    try {
      const next = await invokePython<CbetaCorpusStatus>({ op: 'status' });
      setCorpus(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, []);

  const search = useCallback(async (text: string) => {
    try {
      const next = await invokePython<CbetaWorkHit[]>({ op: 'search', query: text, limit: 40 });
      setHits(next);
      setSelected((cur) =>
        cur && next.some((h) => h.work_id === cur.work_id) ? cur : (next[0] ?? null),
      );
    } catch (e) {
      // search stub raises until catalog_index is built (planning §5.7)
      setHits([]);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshStatus().then((info) => {
      if (info?.present) void search('');
    });
  }, [open, refreshStatus, search]);

  useEffect(() => {
    if (!open || !corpus?.present) return;
    const h = window.setTimeout(() => void search(query), 200);
    return () => window.clearTimeout(h);
  }, [open, query, search, corpus?.present]);

  const runImport = async () => {
    if (!selected) return;
    const project = window.__leafWriterProject;
    const rootPath = project?.getProjectRootPath?.();
    const config = project?.getProjectConfig?.();
    const api = window.electronAPI;
    if (!project || !projectReady || !rootPath || !config) {
      setError('Open a project before importing from CBETA.');
      return;
    }
    if (!api?.pluginsInvokePython || !api.writeFile || !api.ensureDirectory) {
      setError('CBETA import is only available in the desktop app.');
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(`Importing ${selected.title}…`);

    try {
      const converted = await invokePython<CbetaConvertPayload>({
        op: 'convert',
        work_id: selected.work_id,
        cross_family: config.schema?.catalogId !== 'cbeta',
      });
      if (!converted?.juan?.length) throw new Error('Python conversion returned no juan.');

      const destDir = joinPath(rootPath, 'imported', 'cbeta', converted.canon, converted.vol);
      await api.ensureDirectory(destDir);
      const used = new Set<string>();
      for (const entry of (await api.readDirectory?.(destDir, { allFiles: true })) ?? []) {
        if (!entry.isDirectory && entry.name.toLowerCase().endsWith('.xml')) {
          used.add(joinPath(destDir, entry.name).replace(/\\/g, '/'));
        }
      }

      const baseStem = converted.work_id || selected.work_id;
      const written: string[] = [];
      const warnings = [...(converted.warnings ?? [])];

      for (const juan of converted.juan) {
        const meta: CbetaTeiMeta = {
          title: converted.title ?? selected.title,
          work_id: converted.work_id,
          canon: converted.canon,
          taisho_vol: converted.taisho_vol || converted.vol,
          taisho_no: converted.taisho_no || converted.no,
          dynasty: converted.dynasty ?? selected.dynasty,
          category: converted.category ?? selected.category,
          juan_n: juan.n,
          juan_title: juan.title,
          stem: baseStem,
          source: 'CBETA 漢文電子佛典 (cbeta-xml-p5)',
          data_version: converted.data_version,
          git_commit: converted.git_commit,
          authorship: converted.authorship,
          work_qid: converted.work_qid,
        };
        const xml = wrapCbetaTeiDocument({ config, meta, bodyXml: juan.body_xml });
        const outputPath = uniqueCbetaXmlPath(
          destDir,
          `${baseStem}_${juan.n.padStart(3, '0')}`,
          used,
        );
        const dir = parentDir(outputPath);
        if (dir) await api.ensureDirectory(dir);
        await api.writeFile(outputPath, xml);
        written.push(outputPath);
        if (juan.straddles?.length) warnings.push(...juan.straddles);
      }

      await project.refreshExplorer?.();
      await project.openFile?.(written[0]);
      setStatus(
        `Imported ${selected.title} as ${written.length} juan file${written.length > 1 ? 's' : ''}.` +
          (warnings.length ? ` ${warnings.length} warning(s) — see console.` : ''),
      );
      if (warnings.length) console.warn('[cbeta-import]', warnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const canImport = Boolean(selected && projectReady && corpus?.present && !busy);

  return (
    <Dialog open={open} onClose={() => onClose?.()} maxWidth="md" fullWidth>
      <DialogTitle>Import from CBETA</DialogTitle>
      <DialogContent>
        {!isPluginEnabled(PLUGIN_ID) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Enable the “CBETA import” plugin in Tools → Plugins.
          </Alert>
        )}

        <Typography variant="body2" sx={{ mb: 2 }}>
          Search the CBETA canon and import a work — one file per juan.
        </Typography>

        {corpus && !corpus.present && (
          <Alert severity="info" sx={{ mb: 2 }}>
            The CBETA corpus is not synced yet. Run Tools → CBETA → Sync corpus (pins tag{' '}
            {corpus.pinned_tag ?? '—'}).
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

        <TextField
          fullWidth
          label="Search by title, work id (T0001), dynasty or 部類"
          value={query}
          disabled={!corpus?.present || busy}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ mb: 2 }}
        />

        <List dense sx={{ maxHeight: 320, overflow: 'auto', border: 1, borderColor: 'divider' }}>
          {hits.length === 0 && (
            <ListItem>
              <ListItemText primary={corpus?.present ? 'No matches.' : 'Corpus not synced.'} />
            </ListItem>
          )}
          {hits.map((hit) => (
            <ListItemButton
              key={hit.work_id}
              selected={selected?.work_id === hit.work_id}
              onClick={() => setSelected(hit)}
            >
              <CorpusWorkRow
                section={hit.category}
                ident={hit.work_id}
                title={hit.title}
                dynasty={hit.dynasty}
                authors={hit.juan_count ? `${hit.juan_count} 卷` : undefined}
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

export const isCbetaImportAvailable = (): boolean =>
  Boolean(window.electronAPI?.pluginsInvokePython);
