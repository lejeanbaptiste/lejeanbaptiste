import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActions, useAppState } from '../overmind';
import { assertImportedXmlWellFormed } from '../desktop/documentImport';
import { ensureImportHeaderEntitiesForPaths } from '../desktop/ensureImportHeaderEntities';
import {
  uniqueWikisourceXmlPath,
  wrapWikisourceTeiDocument,
  type WikisourceTeiMeta,
} from '../desktop/wikisourceImportXml';
import type { IDialog } from './type';

interface EditionTree {
  id: string;
  label: string;
  rootTitle: string;
  kind: string;
  pages: string[];
}

interface InspectResult {
  url: string;
  apiHost: string;
  pageTitle: string;
  workTitle: string;
  scope: 'page' | 'work';
  trees: EditionTree[];
  wikidata: {
    qid: string | null;
    title: string;
    authors: { qid?: string; name: string }[];
    publicationDate: string | null;
    ctextWorkId: string | null;
  };
}

export interface WikisourceImportDialogProps extends IDialog {
  initialUrl?: string;
  importScope?: 'page' | 'work';
  /** Opened from the browser extension: import straight away and close, unless
   * the work has multiple edition trees to choose from. */
  autoRun?: boolean;
}

const joinPath = (...parts: string[]): string =>
  parts.filter(Boolean).join('/').replace(/\/+/g, '/');

export const WikisourceImportDialog = ({
  initialUrl = '',
  autoRun = false,
  onClose,
  open = true,
}: WikisourceImportDialogProps) => {
  const { notifyViaSnackbar } = useActions().ui;
  const { refreshExplorer } = useActions().project;
  const { config, isProjectReady, rootPath } = useAppState().project;
  const [url, setUrl] = useState(initialUrl);
  const [inspecting, setInspecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [inspected, setInspected] = useState<InspectResult | null>(null);
  const [treeId, setTreeId] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const selectedTree = useMemo(
    () => inspected?.trees.find((tree) => tree.id === treeId) ?? inspected?.trees[0] ?? null,
    [inspected, treeId],
  );

  const titlesToImport = useMemo(() => {
    if (!inspected || !selectedTree) return [];
    if (inspected.scope === 'page') return [inspected.pageTitle];
    return selectedTree.pages;
  }, [inspected, selectedTree]);

  const inspect = useCallback(
    async (target = url) => {
      const api = window.electronAPI;
      if (!api?.wikisourceInspect) {
        setError('Wikisource import is only available in the desktop app.');
        return;
      }
      setInspecting(true);
      setError(null);
      setInspected(null);
      try {
        const result = (await api.wikisourceInspect(target.trim())) as InspectResult;
        setInspected(result);
        setTreeId(result.trees[0]?.id ?? '');
      } catch (inspectError) {
        setError(inspectError instanceof Error ? inspectError.message : String(inspectError));
      } finally {
        setInspecting(false);
      }
    },
    [url],
  );

  useEffect(() => {
    if (initialUrl.trim()) void inspect(initialUrl);
    // Inspect the URL sent by the extension once; typing uses the Inspect button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  // One-click path from the extension: once inspected, import and close — unless
  // the user has to pick an edition tree.
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (!autoRun || !inspected || didAutoRun.current) return;
    const needsTreeChoice = inspected.scope === 'work' && inspected.trees.length > 1;
    if (needsTreeChoice) return;
    didAutoRun.current = true;
    void runImport();
    // runImport is recreated each render but closes over the fresh `inspected`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, inspected]);

  const handleClose = () => {
    abortRef.current?.abort();
    onClose?.('close');
  };

  const runImport = async () => {
    if (!inspected || !selectedTree) return;
    if (!isProjectReady || !rootPath || !config) {
      setError('Open a project before importing from Wikisource.');
      return;
    }
    const api = window.electronAPI;
    if (!api?.wikisourceFetchPage || !api.writeFile || !api.ensureDirectory) {
      setError('Wikisource import is only available in the desktop app.');
      return;
    }

    const destDir = joinPath(rootPath, 'imported', 'wikisource', inspected.workTitle);
    const used = new Set<string>();
    // The extension one-click path skips the prompt — imports never overwrite
    // (colliding names get a numeric suffix), so there's nothing to confirm.
    if (!autoRun && api.pathExists) {
      const exists = await api.pathExists(destDir);
      if (exists) {
        const box = await api.showNativeMessageBox?.({
          type: 'question',
          title: 'Overwrite Wikisource import?',
          message: `Folder already exists:\n${destDir}\n\nNew files will be added; colliding names get a numeric suffix unless you cancel.`,
          buttons: ['Continue', 'Cancel'],
          cancelId: 1,
          defaultId: 0,
        });
        if (box && box.response !== 0) return;
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    let written = 0;
    const writtenPaths: string[] = [];
    try {
      await api.ensureDirectory(destDir);
      for (let index = 0; index < titlesToImport.length; index += 1) {
        if (controller.signal.aborted) throw new DOMException('Import cancelled', 'AbortError');
        const title = titlesToImport[index];
        setStatus(`Fetching ${index + 1} of ${titlesToImport.length}: ${title}`);
        const page = await api.wikisourceFetchPage({ apiHost: inspected.apiHost, title });
        const wd = inspected.wikidata;
        const headerCredit = page.header?.author
          ? [page.header.author, page.header.title].filter(Boolean).join(' · ')
          : null;
        const meta: WikisourceTeiMeta = {
          title: wd.title || inspected.workTitle,
          workTitle: inspected.workTitle,
          pageTitle: page.title,
          url: inspected.url,
          qid: wd.qid,
          ctextWorkId: wd.ctextWorkId,
          publicationDate: wd.publicationDate,
          authors: wd.authors,
          headerCredit,
          extractionNote: page.hasPb ? null : 'No page breaks recovered from wikitext.',
        };
        const xml = wrapWikisourceTeiDocument({ config, meta, bodyXml: page.bodyXml });
        assertImportedXmlWellFormed(xml, `Wikisource import for ${page.title}`);
        const outputPath = uniqueWikisourceXmlPath(destDir, page.stem, used);
        await api.writeFile(outputPath, xml);
        written += 1;
        writtenPaths.push(outputPath);
      }
      await ensureImportHeaderEntitiesForPaths(writtenPaths);
      await refreshExplorer();
      notifyViaSnackbar(
        `Imported ${written} Wikisource file(s) to imported/wikisource/${inspected.workTitle}/.`,
      );
      handleClose();
    } catch (importError) {
      if (importError instanceof DOMException && importError.name === 'AbortError') {
        setStatus(`Stopped after ${written} file(s).`);
      } else {
        setError(importError instanceof Error ? importError.message : String(importError));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Import from Wikisource</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Wikisource URL"
          margin="dense"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={busy}
        />
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
        {inspected ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">
              Page: {inspected.pageTitle}
              {inspected.scope === 'page' ? ' (single chapter/juan)' : ' (work root)'}
            </Typography>
            <Typography variant="body2">
              Wikidata:{' '}
              {inspected.wikidata.qid
                ? `${inspected.wikidata.qid} · ${inspected.wikidata.title}`
                : 'no sitelink'}
            </Typography>
            {inspected.wikidata.authors.length ? (
              <Typography variant="body2">
                Authors: {inspected.wikidata.authors.map((author) => author.name).join(', ')}
              </Typography>
            ) : null}
            {inspected.trees.length > 1 && inspected.scope === 'work' ? (
              <RadioGroup
                sx={{ mt: 1 }}
                value={treeId}
                onChange={(event) => setTreeId(event.target.value)}
              >
                {inspected.trees.map((tree) => (
                  <FormControlLabel
                    key={tree.id}
                    value={tree.id}
                    control={<Radio />}
                    label={tree.label}
                  />
                ))}
              </RadioGroup>
            ) : (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {titlesToImport.length} file(s) → imported/wikisource/{inspected.workTitle}/
              </Typography>
            )}
          </Box>
        ) : null}
        {busy || inspecting ? <LinearProgress sx={{ mt: 2 }} /> : null}
        {status ? (
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            {status}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        {busy ? (
          <Button onClick={() => abortRef.current?.abort()}>Stop</Button>
        ) : (
          <Button onClick={handleClose}>Close</Button>
        )}
        <Button onClick={() => void inspect()} disabled={busy || inspecting || !url.trim()}>
          Inspect
        </Button>
        <Button
          variant="contained"
          onClick={() => void runImport()}
          disabled={busy || inspecting || !inspected || !titlesToImport.length}
        >
          Import {titlesToImport.length || ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
