import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import {
  AutoTaggingSession,
  crawlEntities,
  dictionaryTag,
  entriesFromRows,
  parseDictionaryTable,
  readSpreadsheet,
  ReviewPanel,
  type DictionaryEntry,
  type Suggestion,
} from '../../autoTagging';
import type { IDialog } from '../type';

const SPREADSHEET_RE = /\.(xlsx|xlsm|ods)$/i;

type Step = 'choose' | 'review';

/**
 * The auto-tagging entry point (Phase 2 shell): method chooser → producer →
 * shared review walk. Dictionary import is live; dates/AI/NER are stubs for
 * later phases. Big dialog per the "not something the user does all the
 * time" UI decision.
 */
export const AutoTaggingDialog = ({ id, onClose, open = false }: IDialog) => {
  const [step, setStep] = useState<Step>('choose');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(0);
  const [canRevert, setCanRevert] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const session = useRef<AutoTaggingSession | null>(null);

  const getSession = () => {
    session.current ??= new AutoTaggingSession(window.writer);
    return session.current;
  };

  const handleClose = () => onClose?.(id);

  /** Filter, match, and open the review walk for a set of dictionary entries. */
  const produceFromEntries = async (parsed: DictionaryEntry[], sourceLabel: string) => {
    if (parsed.length === 0) {
      setError('No usable entries found. Expected columns: string, tag (then optional attributes, entityId).');
      return;
    }
    // Single-character strings match far too broadly in running text
    // (bare surnames, common characters), so drop them.
    const entries = parsed.filter((entry) => [...entry.string].length > 1);
    const dropped = parsed.length - entries.length;
    if (entries.length === 0) {
      setError(`All ${parsed.length} entries were single-character strings, which are skipped.`);
      return;
    }
    const doc = await getSession().getDocument();
    const produced = dictionaryTag(doc, entries, getSession().policy, sourceLabel);
    if (produced.length === 0) {
      setError(
        `No untagged matches in the document for the ${entries.length} entries` +
          (dropped > 0 ? ` (${dropped} single-character entries skipped).` : '.'),
      );
      return;
    }
    setSuggestions(produced);
    setStep('review');
  };

  const importDictionary = async (file: File) => {
    setError(null);
    try {
      const entries = SPREADSHEET_RE.test(file.name)
        ? entriesFromRows(await readSpreadsheet(await file.arrayBuffer(), file.name))
        : parseDictionaryTable(await file.text());
      await produceFromEntries(entries, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const crawlCurrentDocument = async () => {
    setError(null);
    try {
      const doc = await getSession().getDocument();
      const entries = crawlEntities(doc, getSession().policy);
      if (entries.length === 0) {
        setError('No tagged entities found in this document to crawl.');
        return;
      }
      await produceFromEntries(entries, 'this document');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleApply = (accepted: Suggestion[]) => {
    void getSession()
      .apply(accepted)
      .then((result) => {
        setApplied((n) => n + result.applied);
        setCanRevert(getSession().canRevert);
      });
  };

  const handleRevert = () => {
    getSession().revertLastApply();
    setCanRevert(getSession().canRevert);
    setApplied(0);
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>Auto-tagging</DialogTitle>
      <DialogContent sx={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <Alert severity="warning" onClose={() => setError(null)} sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}

        {step === 'choose' && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Choose a tagging method. Suggestions go through a review walk before anything is
              applied to the document.
            </Typography>
            <Button variant="outlined" onClick={() => fileInput.current?.click()}>
              Dictionary (import CSV, TSV, xlsx, or ods table)
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xlsm,.ods"
              hidden
              data-testid="dictionary-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importDictionary(file);
                event.target.value = '';
              }}
            />
            <Button variant="outlined" onClick={() => void crawlCurrentDocument()}>
              From existing tags in this document
            </Button>
            <Button variant="outlined" disabled>
              East Asian dates (coming later)
            </Button>
            <Button variant="outlined" disabled>
              AI suggest (coming later)
            </Button>
            <Button variant="outlined" disabled>
              NER (coming later)
            </Button>
          </Stack>
        )}

        {step === 'review' && (
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            <ReviewPanel
              suggestions={suggestions}
              onApply={handleApply}
              onFocus={(s) => getSession().focus(s)}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {step === 'review' && (
          <>
            {applied > 0 && (
              <Typography variant="caption" sx={{ mr: 'auto', ml: 1 }}>
                {applied} tag{applied === 1 ? '' : 's'} applied
              </Typography>
            )}
            <Button onClick={() => setStep('choose')}>Back</Button>
            <Button onClick={handleRevert} disabled={!canRevert} data-testid="revert-apply">
              Revert last apply
            </Button>
          </>
        )}
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
