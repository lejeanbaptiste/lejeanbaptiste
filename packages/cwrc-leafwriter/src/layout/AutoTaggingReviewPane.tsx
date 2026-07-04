import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { takeAutoTaggingBatch } from '../autoTagging/batchHolder';
import { AutoTaggingSession, ReviewPanel, type Suggestion } from '../autoTagging';
import { useActions, useAppState } from '../overmind';
import { AutoTaggingApplyOverlay } from './AutoTaggingApplyOverlay';

/** Default width when docked beside the editor (desktop shell). */
export const AUTO_TAGGING_PANEL_WIDTH = 380;

const isDesktopApp = () => typeof window !== 'undefined' && !!window.electronAPI;

/**
 * Docked review walk for auto-tagging. Shown only while a batch is active —
 * like Translation Mode, not a permanent sidebar panel.
 */
export const AutoTaggingReviewPane = () => {
  const { t } = useTranslation('LW');
  const active = useAppState().ui.autoTaggingReview?.active ?? false;
  const { exitAutoTaggingReview } = useActions().ui;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applied, setApplied] = useState(0);
  const [canRevert, setCanRevert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<'Applying tags…' | 'Reverting tags…'>('Applying tags…');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const session = useRef<AutoTaggingSession | null>(null);

  useEffect(() => {
    if (active) {
      setSuggestions(takeAutoTaggingBatch());
      setApplied(0);
      setCanRevert(false);
    } else {
      setSuggestions([]);
      session.current = null;
    }
  }, [active]);

  // Desktop: expand the shell mount point between editor and right sidebar.
  useEffect(() => {
    if (!isDesktopApp()) return;
    const mount = document.getElementById('desktop-panel-auto-tagging');
    if (!mount) return;
    if (active) {
      mount.style.display = 'block';
      mount.style.width = `${AUTO_TAGGING_PANEL_WIDTH}px`;
      mount.style.minWidth = '0';
      mount.style.maxWidth = `${AUTO_TAGGING_PANEL_WIDTH}px`;
    } else {
      mount.style.display = 'none';
      mount.style.width = '0';
      mount.style.minWidth = '0';
      mount.style.maxWidth = '0';
    }
    try {
      window.writer?.layoutManager?.resizeEditor();
    } catch {
      // layout may not be ready yet
    }
  }, [active]);

  const getSession = useCallback(() => {
    if (!window.writer) throw new Error('Editor not ready');
    session.current ??= new AutoTaggingSession(window.writer);
    return session.current;
  }, []);

  const handleClose = useCallback(() => {
    if (busy) return;
    if (session.current) void session.current.flushDecisions();
    session.current = null;
    setApplied(0);
    setCanRevert(false);
    exitAutoTaggingReview();
  }, [busy, exitAutoTaggingReview]);

  const handleApply = useCallback(
    (accepted: Suggestion[]) => {
      if (busy) return;
      void (async () => {
        setBusyLabel('Applying tags…');
        setProgress({ done: 0, total: accepted.length });
        setBusy(true);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        try {
          const result = await getSession().apply(accepted, [], (done, total) => {
            setProgress({ done, total });
          });
          setApplied((n) => n + result.applied);
          setCanRevert(getSession().canRevert);
        } catch (error) {
          console.error('[auto-tagging] apply failed', error);
        } finally {
          setBusy(false);
          setProgress({ done: 0, total: 0 });
        }
      })();
    },
    [busy, getSession],
  );

  const handleRevert = useCallback(() => {
    if (busy) return;
    void (async () => {
      setBusyLabel('Reverting tags…');
      setProgress({ done: 0, total: 0 });
      setBusy(true);
      try {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        getSession().revertLastApply();
        setCanRevert(getSession().canRevert);
        setApplied(0);
      } catch (error) {
        console.error('[auto-tagging] revert failed', error);
      } finally {
        setBusy(false);
        setProgress({ done: 0, total: 0 });
      }
    })();
  }, [busy, getSession]);

  const handleFocus = useCallback(
    (suggestion: Suggestion) => {
      try {
        getSession().focus(suggestion);
      } catch {
        // focusing is best-effort
      }
    },
    [getSession],
  );

  const handleDecision = useCallback(
    (event: Parameters<AutoTaggingSession['logDecision']>[0]) => {
      try {
        getSession().logDecision(event);
      } catch {
        // logging is best-effort until the editor is ready
      }
    },
    [getSession],
  );

  if (!active) return null;

  return (
    <>
      <AutoTaggingApplyOverlay
        open={busy}
        label={busyLabel}
        done={progress.done}
        total={progress.total}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderLeft: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}
        >
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }} noWrap>
            {t('Auto-tagging')}
          </Typography>
          {applied > 0 && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {t('{{count}} applied', { count: applied })}
            </Typography>
          )}
          <Tooltip title={t('Revert last apply')}>
            <span>
              <Link
                component="button"
                variant="caption"
                underline="hover"
                onClick={canRevert && !busy ? handleRevert : undefined}
                sx={{
                  color: canRevert && !busy ? undefined : 'text.disabled',
                  whiteSpace: 'nowrap',
                }}
                data-testid="revert-apply"
              >
                {t('Revert')}
              </Link>
            </span>
          </Tooltip>
          <Tooltip title={t('Close review')}>
            <IconButton
              size="small"
              onClick={handleClose}
              disabled={busy}
              aria-label={t('Close auto-tagging review')}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          <ReviewPanel
            autoFocus={false}
            busy={busy}
            suggestions={suggestions}
            onApply={handleApply}
            onFocus={handleFocus}
            onDecision={handleDecision}
            onClose={handleClose}
          />
        </Box>
      </Box>
    </>
  );
};
