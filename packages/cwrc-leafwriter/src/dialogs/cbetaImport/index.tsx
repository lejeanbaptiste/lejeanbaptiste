import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
  uniqueCbetaXmlPath,
  wrapCbetaTeiDocument,
  type CbetaTeiMeta,
} from '../../../../../apps/commons/src/desktop/cbetaImportXml';
import { ensureImportHeaderEntitiesForPaths } from '../../../../../apps/commons/src/desktop/ensureImportHeaderEntities';
import { CorpusWorkRow } from '../corpusWorkRow';
import type { IDialog } from '../type';
import { isPluginEnabled } from '../../plugins';

const PLUGIN_ID = 'cbeta-import';

const DIALOG_WIDTH = 720;
const DIALOG_HEIGHT = 580;
const RESULT_LIST_HEIGHT = 320;

type CbetaSplitUnit = 'mulu' | 'juan';

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
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cleanImport, setCleanImport] = useState(true);
  const [stripLineBreaks, setStripLineBreaks] = useState(false);
  const [splitUnit, setSplitUnit] = useState<CbetaSplitUnit>('mulu');

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
    const catalogId = window.__leafWriterProject?.getProjectConfig?.()?.schema?.catalogId ?? '';
    setCleanImport(catalogId !== 'cbeta');
    setStripLineBreaks(false);
    setSplitUnit(catalogId === 'cbeta' ? 'juan' : 'mulu');
    void refreshStatus().then(async (info) => {
      if (info?.present) {
        void search('');
        return;
      }
      setSyncing(true);
      setStatus('Installing the CBETA corpus from GitHub (~1 GB, can take several minutes)…');
      setError(null);
      try {
        await window.electronAPI?.cbetaEnsureCorpus?.();
        const next = await refreshStatus();
        if (next?.present) {
          setStatus('Corpus ready.');
          void search('');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('');
      } finally {
        setSyncing(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        clean: cleanImport,
        strip_lb: stripLineBreaks,
        split_unit: splitUnit,
      });
      if (!converted?.juan?.length) throw new Error('Python conversion returned no sections.');

      const fileLabel = splitUnit === 'mulu' ? 'section' : 'juan';

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

      const importNotes = [
        splitUnit === 'mulu' ? 'Split by CBETA section headings (mulu).' : 'Split by juan.',
        cleanImport ? 'Clean reading edition (collation anchors and apparatus omitted).' : '',
        stripLineBreaks ? 'Taishō line breaks (<lb>) omitted.' : '',
      ]
        .filter(Boolean)
        .join(' ');

      for (const juan of converted.juan) {
        const meta: CbetaTeiMeta = {
          title: converted.title ?? selected.title,
          work_id: converted.work_id,
          canon: converted.canon,
          taisho_vol: converted.taisho_vol || converted.vol,
          taisho_no: converted.taisho_no || converted.no,
          dynasty: converted.dynasty ?? selected.dynasty,
          category: converted.category ?? selected.category,
          split_unit: splitUnit,
          section_n: splitUnit === 'mulu' ? juan.n : undefined,
          section_title: splitUnit === 'mulu' ? juan.title : undefined,
          juan_n: splitUnit === 'juan' ? juan.n : undefined,
          juan_title: splitUnit === 'juan' ? juan.title : undefined,
          stem: baseStem,
          source: 'CBETA 漢文電子佛典 (cbeta-xml-p5)',
          data_version: converted.data_version,
          git_commit: converted.git_commit,
          authorship: converted.authorship,
          work_qid: converted.work_qid,
          importNotes: importNotes || undefined,
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

      await ensureImportHeaderEntitiesForPaths(written);
      await project.refreshExplorer?.();
      await project.openFile?.(written[0]);
      setStatus(
        `Imported ${selected.title} as ${written.length} ${fileLabel} file${written.length > 1 ? 's' : ''}.` +
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

  const canImport = Boolean(selected && projectReady && corpus?.present && !busy && !syncing);
  const working = busy || syncing;

  return (
    <Dialog
      open={open}
      onClose={() => onClose?.()}
      maxWidth={false}
      scroll="paper"
      PaperProps={{
        sx: {
          width: DIALOG_WIDTH,
          height: DIALOG_HEIGHT,
          maxWidth: DIALOG_WIDTH,
          maxHeight: DIALOG_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ flexShrink: 0 }}>Import from CBETA</DialogTitle>
      <DialogContent
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pt: 1,
        }}
      >
        {!isPluginEnabled(PLUGIN_ID) && (
          <Alert severity="warning" sx={{ mb: 1, flexShrink: 0 }}>
            Enable the “CBETA import” plugin in Tools → Plugins.
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexShrink: 0 }}>
          <Typography
            variant="body2"
            component="label"
            htmlFor="cbeta-split-unit"
            sx={{ flexShrink: 0 }}
          >
            Split by
          </Typography>
          <FormControl size="small" sx={{ minWidth: 200 }} disabled={working}>
            <Select
              id="cbeta-split-unit"
              value={splitUnit}
              onChange={(e) => setSplitUnit(e.target.value as CbetaSplitUnit)}
            >
              <MenuItem value="mulu">Section (mulu)</MenuItem>
              <MenuItem value="juan">Juan (卷)</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <FormGroup sx={{ mb: 1, flexShrink: 0 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={cleanImport}
                disabled={working}
                onChange={(e) => setCleanImport(e.target.checked)}
              />
            }
            label="Clean import (Remove collation anchors, back-matter; text follows the Taishō edition.)"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={stripLineBreaks}
                disabled={working}
                onChange={(e) => setStripLineBreaks(e.target.checked)}
              />
            }
            label="Strip Taishō line breaks (&lt;lb&gt;)"
          />
        </FormGroup>

        {working && !error && status && (
          <Box sx={{ flexShrink: 0, mb: 1 }}>
            <LinearProgress sx={{ mb: 0.5 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {status}
            </Typography>
          </Box>
        )}

        {(error || (corpus && !corpus.present && !working)) && (
          <Box sx={{ flexShrink: 0, mb: 1 }}>
            {corpus && !corpus.present && !working && !error && (
              <Alert severity="warning">
                CBETA corpus is not ready. Configure the CBETA import plugin in Tools → Plugins.
              </Alert>
            )}
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Box>
        )}

        {!working && status && !error && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 1, display: 'block', flexShrink: 0 }}
          >
            {status}
          </Typography>
        )}

        <TextField
          fullWidth
          label="Search by title, work id (T0001), dynasty or 部類"
          value={query}
          disabled={!corpus?.present || working}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ mb: 1, flexShrink: 0 }}
        />

        <List
          dense
          sx={{
            flex: 1,
            minHeight: RESULT_LIST_HEIGHT,
            overflow: 'auto',
            border: 1,
            borderColor: 'divider',
          }}
        >
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
      <DialogActions sx={{ flexShrink: 0 }}>
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
