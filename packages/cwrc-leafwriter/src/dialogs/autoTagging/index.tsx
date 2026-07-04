import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import {
  AutoTaggingSession,
  crawlDocuments,
  dictionaryTag,
  entriesFromRows,
  parseDictionaryTable,
  readSpreadsheet,
  type DictionaryEntry,
  type Suggestion,
} from '../../autoTagging';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';

const SPREADSHEET_RE = /\.(xlsx|xlsm|ods)$/i;

/**
 * Method chooser for auto-tagging. Produces suggestions, then hands off to the
 * docked review panel (split screen) — the editor stays visible, not greyed out.
 */
export const AutoTaggingDialog = ({ id, onClose, open = false }: IDialog) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const session = useRef<AutoTaggingSession | null>(null);
  const { startAutoTaggingReview } = useActions().ui;

  const getSession = () => {
    session.current ??= new AutoTaggingSession(window.writer);
    return session.current;
  };

  const beginReview = (produced: Suggestion[]) => {
    startAutoTaggingReview(produced);
    onClose?.(id);
  };

  const openReview = async (parsed: DictionaryEntry[], sourceLabel: string) => {
    if (parsed.length === 0) {
      setError('No usable entries found. Expected columns: string, tag.');
      return;
    }
    const doc = await getSession().getDocument();
    const produced = dictionaryTag(doc, parsed, getSession().policy, sourceLabel);
    if (produced.length === 0) {
      setError(`No untagged matches in the document for these ${parsed.length} entries.`);
      return;
    }
    beginReview(produced);
  };

  const importList = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const entries = SPREADSHEET_RE.test(file.name)
        ? entriesFromRows(await readSpreadsheet(await file.arrayBuffer(), file.name))
        : parseDictionaryTable(await file.text());
      await openReview(entries, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const crawlProject = async () => {
    setError(null);
    setBusy(true);
    try {
      const { documents, available } = await getSession().getProjectDocuments();
      const entries = crawlDocuments(documents, getSession().policy);
      if (entries.length === 0) {
        setError(
          available
            ? 'No tagged entities found in the project to crawl.'
            : 'No tagged entities found in this document to crawl.',
        );
        return;
      }
      await openReview(entries, available ? 'the project' : 'this document');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    onClose?.(id);
  };

  const methodButton = (label: string, onClick: () => void, disabled = false) => (
    <Button
      size="small"
      variant="text"
      disabled={disabled || busy}
      onClick={onClick}
      sx={{ justifyContent: 'flex-start', textTransform: 'none', px: 1, py: 0.25 }}
    >
      {label}
    </Button>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: 340, m: 1, borderRadius: 1 } }}
    >
      <DialogContent sx={{ p: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Auto-tagging
        </Typography>

        {error && (
          <Alert severity="warning" variant="outlined" onClose={() => setError(null)} sx={{ my: 1, py: 0, fontSize: 12 }}>
            {error}
          </Alert>
        )}

        <Stack sx={{ mt: 0.5 }}>
          {methodButton('Tag from a list (CSV, TSV, xlsx, ODS)', () => fileInput.current?.click())}
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xlsm,.ods"
            hidden
            data-testid="dictionary-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importList(file);
              event.target.value = '';
            }}
          />
          {methodButton('From existing tags in this project', () => void crawlProject())}
          {methodButton('East Asian dates', () => {}, true)}
          {methodButton('AI suggest', () => {}, true)}
          {methodButton('NER', () => {}, true)}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
            <Link component="button" variant="caption" underline="hover" onClick={handleClose}>
              Close
            </Link>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
