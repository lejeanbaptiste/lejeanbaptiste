import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startBackgroundAuthorityPrefetch,
  stopBackgroundAuthorityPrefetch,
} from '../autoTagging/backgroundAuthorityPrefetch';
import { takeAutoTaggingBatch, takeAutoTaggingNotice } from '../autoTagging/batchHolder';
import {
  AutoTaggingSession,
  ReviewPanel,
  aiApiSettingsFromDesktop,
  autoTaggingDocumentKey,
  createLlmClientFromSettings,
  isAiSuggestReady,
  isDateCuratorBatch,
  isDateTagOnlyBatch,
  markDatesPassApplied,
  markDatesPassRan,
  validateSuggestions,
  prepareSuggestionsForReview,
  type Suggestion,
} from '../autoTagging';
import { findPluginReviewPanel } from '../plugins/pluginExtensions';
import { cachedPackReader } from '../services/authority-pack-lookup';
import { currentUserRules } from '../autoTagging/autoTaggingExclusions';
import { useActions, useAppState } from '../overmind';
import { AutoTaggingApplyOverlay, type AutoTaggingBusyLabel } from './AutoTaggingApplyOverlay';
import { DockedResizeHandle, useStoredPanelWidth } from './DockedResizeHandle';
import {
  DOCKED_AUTO_TAGGING_MOUNT_ID,
  scheduleDesktopEditorRelayout,
  setDockedReviewMountOpen,
} from './dockedReviewLayout';

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
  const batchId = useAppState().ui.autoTaggingReview?.batchId ?? 0;
  const aiValidationEnabled = useAppState().ui.autoTaggingReview?.aiValidation ?? true;
  const { exitAutoTaggingReview } = useActions().ui;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applied, setApplied] = useState(0);
  const [canRevert, setCanRevert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyLabel, setBusyLabel] = useState<AutoTaggingBusyLabel>('Applying tags…');
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewPanelReady, setReviewPanelReady] = useState(false);
  const [applyDiagnostics, setApplyDiagnostics] = useState<string | null>(null);
  const [applyDiagSeverity, setApplyDiagSeverity] = useState<
    'error' | 'warning' | 'success' | 'info'
  >('info');
  const session = useRef<AutoTaggingSession | null>(null);
  const [panelWidth, setPanelWidth] = useStoredPanelWidth(
    'lw.autoTagging.panelWidth',
    AUTO_TAGGING_PANEL_WIDTH,
  );

  // Let the dock/header paint before mounting the suggestion list. The review
  // list can contain many rows and mounting it in the same task as opening
  // the pane makes the first paint and first keypress feel stalled.
  useEffect(() => {
    if (!active) {
      setReviewPanelReady(false);
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setReviewPanelReady(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [active]);

  const getSession = useCallback(() => {
    if (!window.writer) throw new Error('Editor not ready');
    session.current ??= new AutoTaggingSession(window.writer);
    return session.current;
  }, []);

  useEffect(() => {
    if (!active) {
      setSuggestions([]);
      setNotice(null);
      setApplyDiagnostics(null);
      setApplyDiagSeverity('info');
      if (session.current) void session.current.flushDecisions();
      session.current = null;
      return;
    }

    const batch = takeAutoTaggingBatch();
    setNotice(takeAutoTaggingNotice());
    setApplyDiagnostics(null);
    setApplyDiagSeverity('info');
    setApplied(0);
    setCanRevert(false);

    let cancelled = false;
    void (async () => {
      try {
        const session = getSession();
        const doc = await session.getDocument();
        const { suggestions: prepared } = prepareSuggestionsForReview(doc, session.policy, batch);
        if (cancelled) return;
        setSuggestions(prepared);

        if (
          !aiValidationEnabled ||
          prepared.length === 0 ||
          isDateCuratorBatch(prepared) ||
          isDateTagOnlyBatch(prepared)
        ) {
          return;
        }
        const settings = aiApiSettingsFromDesktop();
        if (!settings || !isAiSuggestReady(settings)) return;

        const client = createLlmClientFromSettings(settings);
        const results = await validateSuggestions({
          suggestions: prepared,
          client,
        });
        if (cancelled || results.size === 0) return;
        setSuggestions((current) =>
          current.map((s) => {
            const validation = results.get(s.id);
            return validation ? { ...s, aiValidation: validation } : s;
          }),
        );
      } catch (error) {
        console.warn('[auto-tagging] Failed to prepare review batch:', error);
        if (!cancelled) setSuggestions(batch);
      }
    })();

    return () => {
      cancelled = true;
    };
    // batchId reloads when a new run starts while the panel is already open
    // (e.g. tag dates → resolve dates). aiValidation is fixed per batch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, batchId]);

  useEffect(() => {
    if (!active) return;
    const append = (event: Event) => {
      const additions = (event as CustomEvent<Suggestion[]>).detail ?? [];
      if (additions.length === 0) return;
      void (async () => {
        try {
          const session = getSession();
          const doc = await session.getDocument();
          setSuggestions((current) => {
            const { suggestions: prepared } = prepareSuggestionsForReview(doc, session.policy, [
              ...current,
              ...additions,
            ]);
            return prepared;
          });
        } catch (error) {
          console.warn('[auto-tagging] Failed to prepare appended suggestions:', error);
          setSuggestions((current) => [...current, ...additions]);
        }
      })();
    };
    window.addEventListener('desktop:auto-tagging-review-append', append);
    return () => window.removeEventListener('desktop:auto-tagging-review-append', append);
  }, [active]);

  // Desktop: expand/collapse the shell mount between editor and right sidebar.
  // Width updates re-run only the open path so a drag never flashes the
  // mount closed; the close cleanup is keyed on `active` alone.
  useEffect(() => {
    if (!isDesktopApp() || !active) return;
    setDockedReviewMountOpen(DOCKED_AUTO_TAGGING_MOUNT_ID, true, panelWidth);
    scheduleDesktopEditorRelayout();
  }, [active, panelWidth]);

  useEffect(() => {
    if (!isDesktopApp() || !active) return;
    return () => {
      setDockedReviewMountOpen(DOCKED_AUTO_TAGGING_MOUNT_ID, false);
      scheduleDesktopEditorRelayout();
    };
  }, [active]);

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
      const closeAfterApply = isDateCuratorBatch(accepted) || isDateCuratorBatch(suggestions);
      void (async () => {
        setBusyLabel('Applying tags…');
        setBusy(true);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        try {
          const result = await getSession().apply(accepted, currentUserRules());
          if (accepted.some((s) => s.source === 'dates' && s.action === 'resolve-date')) {
            markDatesPassApplied(autoTaggingDocumentKey(window.writer));
          } else if (
            accepted.some((s) => s.source === 'dates' && s.action === 'add') &&
            !isDateTagOnlyBatch(suggestions)
          ) {
            markDatesPassRan(autoTaggingDocumentKey(window.writer));
          }
          setApplied((n) => n + result.applied);
          setCanRevert(getSession().canRevert);
          // Norbert's second pass runs only after component tags have landed.
          // It is intentionally best-effort: projects without the optional
          // wrapper pack simply continue with the ordinary review batch.
          if (result.applied > 0) {
            const readPack = cachedPackReader();
            if (readPack) {
              try {
                const wrapperBatch = await getSession().runPersonWrapperConcatenation(readPack);
                if (wrapperBatch.suggestions.length > 0) {
                  const currentDoc = await getSession().getDocument();
                  setSuggestions(
                    (current) =>
                      prepareSuggestionsForReview(currentDoc, getSession().policy, [
                        ...current,
                        ...wrapperBatch.suggestions,
                      ]).suggestions,
                  );
                  setNotice(
                    `${wrapperBatch.matchCount} Norbert person-wrapper candidate${wrapperBatch.matchCount === 1 ? '' : 's'} found after component tagging.`,
                  );
                }
              } catch (error) {
                console.warn('[auto-tagging] Norbert wrapper concatenation failed:', error);
              }
            }
          }
          // Warm the disambiguation caches for the freshly applied tags while
          // the user reviews — gently paced so the editor stays responsive.
          if (result.applied > 0 && window.writer) {
            startBackgroundAuthorityPrefetch(window.writer);
          }
          if (result.diagnostics) {
            let text = result.diagnostics.summary;
            if (result.diagnostics.lines.length > 0) {
              text += `\n\n${result.diagnostics.lines
                .slice(0, 5)
                .map((line) => `• "${line.surface}" (${line.outcome}): ${line.reason}`)
                .join('\n')}`;
            }
            setApplyDiagnostics(text);
            setApplyDiagSeverity(
              result.applied === 0
                ? 'error'
                : result.applied < accepted.length
                  ? 'warning'
                  : 'success',
            );
          }
          if (result.textIntegrityWarning) {
            // A suggestion changed the document's text content when applied —
            // autotagging must only ever add markup, never rewrite source
            // text. Surfaced as loudly as a validation error, since that's
            // exactly the severity of what it means.
            setApplyDiagnostics(
              (current) =>
                `${current ? `${current}\n\n` : ''}Text integrity warning:\n${result.textIntegrityWarning}`,
            );
            setApplyDiagSeverity('error');
          }
          if (result.personWrapperValidation?.errors.length) {
            const wrapperText = result.personWrapperValidation.errors.slice(0, 3).join('\n');
            setApplyDiagnostics(
              (current) =>
                `${current ? `${current}\n\n` : ''}Person-wrapper validation:\n${wrapperText}`,
            );
            setApplyDiagSeverity('error');
          }
          // Resolve is a finishing pass — close once attributes are written.
          if (closeAfterApply && result.applied > 0) {
            if (session.current) void session.current.flushDecisions();
            session.current = null;
            setApplied(0);
            setCanRevert(false);
            exitAutoTaggingReview();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[auto-tagging] apply failed', error);
          setApplyDiagnostics(`Apply threw an error: ${message}`);
          setApplyDiagSeverity('error');
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, exitAutoTaggingReview, getSession, suggestions],
  );

  const handleRefresh = useCallback(() => {
    if (busy || refreshing) return;
    void (async () => {
      setRefreshing(true);
      try {
        const readPack = cachedPackReader();
        if (!readPack) return;
        const result = await getSession().refreshReviewBatch(suggestions, readPack);
        setSuggestions(result.suggestions);
        const parts: string[] = [];
        if (result.staleCount > 0) {
          parts.push(
            `${result.staleCount} suggestion${result.staleCount === 1 ? '' : 's'} no longer applied and ${result.staleCount === 1 ? 'was' : 'were'} removed`,
          );
        }
        if (result.wrapperMatchCount > 0) {
          parts.push(
            `${result.wrapperMatchCount} person-wrapper/noble-title candidate${result.wrapperMatchCount === 1 ? '' : 's'} found`,
          );
        }
        if (parts.length > 0) setNotice(parts.join('; ') + '.');
      } catch (error) {
        console.warn('[auto-tagging] refresh failed:', error);
      } finally {
        setRefreshing(false);
      }
    })();
  }, [busy, refreshing, getSession, suggestions]);

  const handleRevert = useCallback(() => {
    if (busy) return;
    void (async () => {
      setBusyLabel('Reverting tags…');
      setBusy(true);
      try {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        getSession().revertLastApply();
        stopBackgroundAuthorityPrefetch();
        setCanRevert(getSession().canRevert);
        setApplied(0);
      } catch (error) {
        console.error('[auto-tagging] revert failed', error);
      } finally {
        setBusy(false);
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

      const docKey = autoTaggingDocumentKey(window.writer);
      if (
        isDateTagOnlyBatch(suggestions) &&
        (event.decision === 'accepted' || event.decision === 'rejected')
      ) {
        markDatesPassRan(docKey);
      }
    },
    [getSession, suggestions],
  );

  if (!active) return null;

  return (
    <>
      <AutoTaggingApplyOverlay open={busy} label={busyLabel} />
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderLeft: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {isDesktopApp() && <DockedResizeHandle width={panelWidth} onResize={setPanelWidth} />}
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

        {notice && (
          <Alert severity="info" sx={{ mx: 1, mt: 1, py: 0.25 }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}

        {applyDiagnostics && (
          <Alert
            severity={applyDiagSeverity}
            sx={{ mx: 1, mt: 1, py: 0.5, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}
            onClose={() => setApplyDiagnostics(null)}
          >
            {applyDiagnostics}
          </Alert>
        )}

        <Box sx={{ flex: 1, minHeight: 0 }}>
          {!reviewPanelReady ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Loading…
              </Typography>
            </Box>
          ) : (
            (() => {
              const pluginPanel = findPluginReviewPanel(suggestions);
              if (pluginPanel) {
                const PluginPanel = pluginPanel.component;
                return (
                  <PluginPanel
                    autoFocus={false}
                    busy={busy}
                    finishWhenIdle={pluginPanel.finishWhenIdle}
                    suggestions={suggestions}
                    onApply={handleApply}
                    onFocus={handleFocus}
                    onDecision={handleDecision}
                    onClose={handleClose}
                  />
                );
              }
              return (
                <ReviewPanel
                  autoFocus={false}
                  busy={busy}
                  suggestions={suggestions}
                  onApply={handleApply}
                  onFocus={handleFocus}
                  onDecision={handleDecision}
                  onClose={handleClose}
                  aiValidationEnabled={aiValidationEnabled}
                  onRefresh={handleRefresh}
                  refreshing={refreshing}
                />
              );
            })()
          )}
        </Box>
      </Box>
    </>
  );
};
