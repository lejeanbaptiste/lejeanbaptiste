import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  FormControlLabel,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AutoTaggingSession,
  autoTaggingDocumentKey,
  countDocumentDates,
  defaultSanmiaoCivSelection,
  inferEastAsianLanguageFromDocument,
  isEastAsianDatesMethodAvailable,
  isResolveDatesPassComplete,
  isTagDatesPassComplete,
  markDatesPassRan,
  resolveAutoTaggingSourceLanguage,
  SANMIAO_CIV_OPTIONS,
  type DocumentDateCounts,
  type SanmiaoCivId,
  type Suggestion,
} from '../../autoTagging';
import { languageLabelForCode } from '../../utilities/languageCodes';
import { AutoTaggingApplyOverlay } from '../../layout/AutoTaggingApplyOverlay';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';

const isDesktopApp = () => typeof window !== 'undefined' && !!window.electronAPI;

export interface CalendarDialogProps extends IDialog {
  /** Shown when opened from a gated action (e.g. disambiguation). */
  notice?: string;
}

const CalendarStepRow = ({
  busy,
  buttonLabel,
  complete,
  count,
  countLabel,
  label,
  onRun,
  variant = 'outlined',
}: {
  busy: boolean;
  buttonLabel: string;
  complete: boolean;
  count: number;
  countLabel: string;
  label: string;
  onRun: () => void;
  variant?: 'contained' | 'outlined';
}) => (
  <Box
    sx={{
      alignItems: 'center',
      border: 1,
      borderColor: complete ? 'success.light' : 'divider',
      borderRadius: 1,
      display: 'flex',
      gap: 1,
      px: 1,
      py: 0.75,
    }}
  >
    <Checkbox checked={complete} disabled size="small" sx={{ p: 0.5 }} tabIndex={-1} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography color="text.secondary" variant="caption">
        {count} {countLabel}
      </Typography>
    </Box>
    <Button disabled={busy} onClick={onRun} size="small" variant={variant}>
      {buttonLabel}
    </Button>
  </Box>
);

/**
 * East Asian calendar workflow: tag date spans, then resolve calendar attributes.
 */
export const CalendarDialog = ({ notice, onClose, open = false }: CalendarDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dateCiv, setDateCiv] = useState<Record<SanmiaoCivId, boolean>>({
    c: true,
    j: false,
    k: false,
  });
  const [dateFuzzy, setDateFuzzy] = useState(false);
  const [datesProgress, setDatesProgress] = useState('');
  const [datesChunkProgress, setDatesChunkProgress] = useState({ done: 0, total: 0 });
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [workflowReady, setWorkflowReady] = useState(false);
  const [documentKey, setDocumentKey] = useState('unknown');
  const [dateCounts, setDateCounts] = useState<DocumentDateCounts>({ tagged: 0, resolved: 0 });
  const [tagPassComplete, setTagPassComplete] = useState(false);
  const [resolvePassComplete, setResolvePassComplete] = useState(false);
  const session = useRef<AutoTaggingSession | null>(null);
  const { startAutoTaggingReview } = useActions().ui;

  const sanmiaoAvailable =
    !!window.electronAPI?.sanmiaoTagDatesBatch ||
    !!window.electronAPI?.sanmiaoProposeDatesBatch ||
    !!window.electronAPI?.sanmiaoProposeDates;
  const calendarOffered =
    isDesktopApp() && sanmiaoAvailable && isEastAsianDatesMethodAvailable(sourceLanguage);

  const getSession = () => {
    session.current ??= new AutoTaggingSession(window.writer);
    return session.current;
  };

  const refreshWorkflowState = useCallback(async () => {
    const doc = await getSession().getDocument();
    const lang = await resolveAutoTaggingSourceLanguage(doc, () =>
      window.__leafWriterProject?.getProjectSourceLanguage?.() ?? Promise.resolve(null),
    );
    const docKey = autoTaggingDocumentKey(window.writer);
    setSourceLanguage(lang);
    setDocumentKey(docKey);
    setDateCiv(defaultSanmiaoCivSelection(lang));
    setDateCounts(countDocumentDates(doc));
    setTagPassComplete(isTagDatesPassComplete(docKey, lang));
    setResolvePassComplete(isResolveDatesPassComplete(docKey, lang));
    setWorkflowReady(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setWorkflowReady(false);
      setError(null);
      return;
    }
    void refreshWorkflowState().catch(async () => {
      try {
        const doc = await getSession().getDocument();
        const inferred = inferEastAsianLanguageFromDocument(doc);
        const docKey = autoTaggingDocumentKey(window.writer);
        setSourceLanguage(inferred);
        setDocumentKey(docKey);
        setDateCiv(defaultSanmiaoCivSelection(inferred));
        setDateCounts(countDocumentDates(doc));
        setTagPassComplete(isTagDatesPassComplete(docKey, inferred));
        setResolvePassComplete(isResolveDatesPassComplete(docKey, inferred));
      } catch {
        setSourceLanguage(null);
      }
      setWorkflowReady(true);
    });
  }, [open, refreshWorkflowState]);

  useEffect(() => {
    if (!open) return;
    const onChanged = () => {
      void refreshWorkflowState().catch(() => undefined);
    };
    window.addEventListener('desktop:calendar-workflow-changed', onChanged);
    window.addEventListener('desktop:auto-tagging-review-close', onChanged);
    const writer = window.writer;
    writer?.event('contentChanged').subscribe(onChanged);
    return () => {
      window.removeEventListener('desktop:calendar-workflow-changed', onChanged);
      window.removeEventListener('desktop:auto-tagging-review-close', onChanged);
      writer?.event('contentChanged').unsubscribe(onChanged);
    };
  }, [open, refreshWorkflowState]);

  const handleClose = () => {
    if (busy) return;
    onClose?.();
  };

  const beginReview = (produced: Suggestion[], reviewNotice?: string) => {
    startAutoTaggingReview({ suggestions: produced, notice: reviewNotice });
    handleClose();
  };

  const makeSanmiaoProgress = (
    setProgress: (label: string) => void,
    verb: string,
  ): import('../../autoTagging/dates').DateTagOptions['onProgress'] => (p) => {
    setDatesChunkProgress({ done: p.done, total: p.total });
    if (p.phase === 'starting') {
      setProgress(
        p.tablesMs != null ? `Tables loaded (${p.tablesMs} ms). ${verb}…` : `${verb}…`,
      );
    } else if (p.phase === 'chunk') {
      const slow = (p.ms ?? 0) > 5000 ? ' — slow' : '';
      setProgress(
        p.total <= 1
          ? `${verb}… ${p.proposalsInChunk ?? 0} items, ${(p.chars ?? 0).toLocaleString()} chars, ${p.ms ?? 0} ms${slow}`
          : `${verb} ${p.done} / ${p.total}: ${p.proposalsInChunk ?? 0} items, ${(p.chars ?? 0).toLocaleString()} chars, ${p.ms ?? 0} ms${slow}`,
      );
    } else if (p.phase === 'mapping') {
      setProgress(`Mapping… ${p.suggestionsSoFar ?? 0} suggestions so far`);
    }
  };

  const selectedCiv = () => SANMIAO_CIV_OPTIONS.filter((o) => dateCiv[o.id]).map((o) => o.id);

  const runEastAsianDateTag = async () => {
    const batchTag = window.electronAPI?.sanmiaoTagDatesBatch;
    if (!batchTag) {
      setError('Sanmiao tag API is not available. Restart the desktop app.');
      return;
    }
    const civ = selectedCiv();
    if (civ.length === 0) {
      setError('Select at least one calendar tradition.');
      return;
    }

    setError(null);
    setBusy(true);
    setDatesProgress('Tagging dates…');
    setDatesChunkProgress({ done: 0, total: 0 });
    try {
      const tagFn: import('../../autoTagging/dates').SanmiaoBatchTagFn = (chunks, opts, onChunk) => {
        const stop = window.electronAPI?.onSanmiaoProgress?.((event) => onChunk?.(event));
        return batchTag(chunks, opts).finally(() => stop?.());
      };

      const result = await getSession().runEastAsianDateTag(tagFn, {
        civ,
        fuzzy: dateFuzzy,
        onProgress: makeSanmiaoProgress(setDatesProgress, 'Tagging'),
      });
      if (result.suggestions.length === 0) {
        markDatesPassRan(documentKey);
        setTagPassComplete(true);
        await refreshWorkflowState();
        setError(
          'No date spans found. Add any missing dates manually, then run Resolve. Auto-tagging is now available.',
        );
        return;
      }
      beginReview(
        result.suggestions,
        'Tag pass — accept or reject at least one date, then apply. Add any missing dates manually before Resolve.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setDatesProgress('');
      setDatesChunkProgress({ done: 0, total: 0 });
    }
  };

  const runEastAsianDateResolve = async () => {
    const batchResolve = window.electronAPI?.sanmiaoResolveDatesBatch;
    if (!batchResolve) {
      setError('Sanmiao resolve API is not available. Restart the desktop app.');
      return;
    }
    const civ = selectedCiv();
    if (civ.length === 0) {
      setError('Select at least one calendar tradition.');
      return;
    }

    setError(null);
    setBusy(true);
    setDatesProgress('Resolving dates…');
    setDatesChunkProgress({ done: 0, total: 0 });
    try {
      const resolveFn: import('../../autoTagging/dates').SanmiaoBatchResolveFn = (
        dates,
        opts,
        onChunk,
      ) => {
        const stop = window.electronAPI?.onSanmiaoProgress?.((event) => onChunk?.(event));
        return batchResolve(dates, opts).finally(() => stop?.());
      };

      const result = await getSession().runEastAsianDateResolve(resolveFn, {
        civ,
        fuzzy: dateFuzzy,
        sequential: true,
        onProgress: makeSanmiaoProgress(setDatesProgress, 'Resolving'),
      });
      if (result.suggestions.length === 0) {
        setError('No <date> elements in the document. Run Tag dates first.');
        return;
      }
      beginReview(result.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setDatesProgress('');
      setDatesChunkProgress({ done: 0, total: 0 });
    }
  };

  return (
    <>
      <AutoTaggingApplyOverlay
        open={busy}
        label={datesProgress || 'Running sanmiao…'}
        done={datesChunkProgress.done}
        total={datesChunkProgress.total}
      />
      <Dialog
        open={open}
        onClose={handleClose}
        PaperProps={{ sx: { width: 400, m: 1, borderRadius: 1 } }}
      >
        <DialogContent sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Calendar
          </Typography>

          {notice && (
            <Alert severity="warning" sx={{ my: 1, py: 0.5, fontSize: 12 }}>
              {notice}
            </Alert>
          )}

          {error && (
            <Alert
              severity="warning"
              variant="outlined"
              onClose={() => setError(null)}
              sx={{ my: 1, py: 0, fontSize: 12 }}
            >
              {error}
            </Alert>
          )}

          {!workflowReady ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Checking document language…
            </Typography>
          ) : !calendarOffered ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Calendar tagging is available for Chinese, Japanese, and Korean documents in the
              desktop app with sanmiao installed.
              {sourceLanguage
                ? ` This document is ${languageLabelForCode(sourceLanguage)}.`
                : ''}
            </Typography>
          ) : (
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Tag date spans first, then resolve calendar attributes in document order.
              </Typography>

              <Stack spacing={0.75}>
                <CalendarStepRow
                  busy={busy}
                  buttonLabel="Tag"
                  complete={tagPassComplete}
                  count={dateCounts.tagged}
                  countLabel="tagged in document"
                  label="Tag dates"
                  onRun={() => void runEastAsianDateTag()}
                  variant="contained"
                />
                <CalendarStepRow
                  busy={busy}
                  buttonLabel="Resolve"
                  complete={resolvePassComplete}
                  count={dateCounts.resolved}
                  countLabel="resolved in document"
                  label="Resolve dates"
                  onRun={() => void runEastAsianDateResolve()}
                />
              </Stack>

              <Typography color="text.secondary" variant="caption">
                Calendar tradition
              </Typography>
              <Stack>
                {SANMIAO_CIV_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.id}
                    control={
                      <Checkbox
                        size="small"
                        checked={dateCiv[opt.id]}
                        disabled={busy}
                        onChange={(event) =>
                          setDateCiv((current) => ({ ...current, [opt.id]: event.target.checked }))
                        }
                      />
                    }
                    label={opt.label}
                    sx={{ ml: 0 }}
                  />
                ))}
              </Stack>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={dateFuzzy}
                    disabled={busy}
                    onChange={(event) => setDateFuzzy(event.target.checked)}
                  />
                }
                label="Fuzzy character matching (variant forms, e.g. simplified ↔ traditional)"
                sx={{ ml: 0 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link
                  component="button"
                  variant="caption"
                  underline="hover"
                  onClick={handleClose}
                  disabled={busy}
                >
                  Close
                </Link>
              </Box>
            </Stack>
          )}

          {!calendarOffered && workflowReady && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Link component="button" variant="caption" underline="hover" onClick={handleClose}>
                Close
              </Link>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
