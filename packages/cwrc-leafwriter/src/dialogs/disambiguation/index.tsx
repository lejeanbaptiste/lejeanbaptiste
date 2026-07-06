import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  AutoTaggingSession,
  autoTaggingDocumentKey,
  inferEastAsianLanguageFromDocument,
  isEastAsianDatesMethodAvailable,
  isDisambiguationUnlockedForDocument,
  resolveAutoTaggingSourceLanguage,
  shouldWarnResolveDatesBeforeAutoTag,
  shouldWarnTagDatesFirst,
} from '../../autoTagging';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';

/** Disambiguation launcher with calendar workflow warnings. */
export const DisambiguationDialog = ({ onClose, open = false }: IDialog) => {
  const { openDialog, startDisambiguationReview } = useActions().ui;
  const [ready, setReady] = useState(false);
  const [calendarWorkflow, setCalendarWorkflow] = useState(false);
  const [tagWarning, setTagWarning] = useState(false);
  const [resolveWarning, setResolveWarning] = useState(false);
  const [canStart, setCanStart] = useState(true);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }

    void (async () => {
      try {
        const session = new AutoTaggingSession(window.writer);
        const doc = await session.getDocument();
        const lang = await resolveAutoTaggingSourceLanguage(doc, () =>
          window.__leafWriterProject?.getProjectSourceLanguage?.() ?? Promise.resolve(null),
        ).catch(() => inferEastAsianLanguageFromDocument(doc));
        const docKey = autoTaggingDocumentKey(window.writer);
        const offered = isEastAsianDatesMethodAvailable(lang);
        setCalendarWorkflow(offered);
        setTagWarning(shouldWarnTagDatesFirst(docKey, lang));
        setResolveWarning(shouldWarnResolveDatesBeforeAutoTag(docKey, lang));
        setCanStart(!offered || isDisambiguationUnlockedForDocument(docKey, lang));
      } catch {
        setCalendarWorkflow(false);
        setTagWarning(false);
        setResolveWarning(false);
        setCanStart(true);
      } finally {
        setReady(true);
      }
    })();
  }, [open]);

  const handleClose = () => onClose?.();

  const openCalendar = (notice?: string) => {
    openDialog({
      type: 'calendar',
      props: {
        id: notice ? `calendar-disambiguation-${Date.now()}` : 'calendar-disambiguation',
        notice,
      },
    });
    handleClose();
  };

  const handleStart = () => {
    if (!canStart) {
      openCalendar(
        tagWarning
          ? 'Tag dates from Calendar before disambiguation — calendar context helps entity linking.'
          : 'Resolve dates before disambiguation — calendar context helps entity linking.',
      );
      return;
    }
    startDisambiguationReview();
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: 380, m: 1, borderRadius: 1 } }}
    >
      <DialogContent sx={{ p: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Disambiguate
        </Typography>

        {!ready ? (
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            Checking document…
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mt: 0.5 }}>
            <Typography color="text.secondary" variant="body2">
              Link tagged mentions to authority records in your entity database.
            </Typography>

            {calendarWorkflow && tagWarning && (
              <Alert severity="warning" sx={{ py: 0.5, fontSize: 12 }}>
                Tag dates from the <strong>Calendar</strong> toolbar button first — calendar
                context helps entity linking.
              </Alert>
            )}

            {calendarWorkflow && resolveWarning && (
              <Alert severity="warning" sx={{ py: 0.5, fontSize: 12 }}>
                Resolve dates from the Calendar button when ready — resolved calendar attributes
                help pick the right authority record.
              </Alert>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Link component="button" onClick={handleClose} underline="hover" variant="caption">
                Cancel
              </Link>
              <Stack direction="row" spacing={0.5}>
                {calendarWorkflow && (tagWarning || !canStart) && (
                  <Button onClick={() => openCalendar()} size="small" variant="outlined">
                    Calendar
                  </Button>
                )}
                <Button onClick={handleStart} size="small" variant="contained">
                  {canStart ? 'Start' : 'Calendar first'}
                </Button>
              </Stack>
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};
