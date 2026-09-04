import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startBackgroundAuthorityPrefetch,
  stopBackgroundAuthorityPrefetch,
} from '../autoTagging/backgroundAuthorityPrefetch';
import {
  takeAutoTaggingBatch,
  takeAutoTaggingNotice,
  takeDateReviewRecalculate,
  takeDateAuthorityCiv,
} from '../autoTagging/batchHolder';
import type { DateReviewRecalculate } from '../autoTagging/batchHolder';
import {
  AutoTaggingSession,
  ReviewPanel,
  aiApiSettingsFromDesktop,
  autoTaggingDocumentKey,
  createLlmClientFromSettings,
  curateRejectBelowFromSettings,
  isAiSuggestReady,
  isAiUiFeatureEnabled,
  isDateCuratorBatch,
  isDateTagOnlyBatch,
  markDatesPassApplied,
  markDatesPassRan,
  persistValidationSettings,
  readPersistedValidationSettings,
  validateSuggestions,
  prepareSuggestionsForReview,
  suggestionLocationKey,
  type Suggestion,
} from '../autoTagging';
import { findPluginReviewPanel } from '../plugins/pluginExtensions';
import { isPluginEnabled } from '../plugins/registry';
import { groupWrapperCandidateSuggestions } from '../autoTagging/wrapperCandidates';
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
  const aiValidationRequested = useAppState().ui.autoTaggingReview?.aiValidation ?? false;
  const aiValidationEnabled = isAiUiFeatureEnabled('tagBombCurate') && aiValidationRequested;
  const { exitAutoTaggingReview } = useActions().ui;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applied, setApplied] = useState(0);
  const [canRevert, setCanRevert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyLabel, setBusyLabel] = useState<AutoTaggingBusyLabel>('Applying tags…');
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewPanelReady, setReviewPanelReady] = useState(false);
  const [norbertEnabled, setNorbertEnabled] = useState(false);
  const [applyDiagnostics, setApplyDiagnostics] = useState<string | null>(null);
  const [applyDiagSeverity, setApplyDiagSeverity] = useState<
    'error' | 'warning' | 'success' | 'info'
  >('info');
  const [aiCurating, setAiCurating] = useState(false);
  const [aiCurateProgress, setAiCurateProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [curateRejectBelow, setCurateRejectBelow] = useState(0);
  const session = useRef<AutoTaggingSession | null>(null);
  const curateAbort = useRef<AbortController | null>(null);
  const dateRecalculate = useRef<DateReviewRecalculate | null>(null);
  const dateAuthorityCiv = useRef<readonly string[] | null>(null);
  /** Locations rejected this review session — keep refresh from resurrecting them. */
  const dismissedLocations = useRef<Set<string>>(new Set());
  const [panelWidth, setPanelWidth] = useStoredPanelWidth(
    'lw.autoTagging.panelWidth',
    AUTO_TAGGING_PANEL_WIDTH,
  );

  useEffect(() => {
    const syncNorbertState = () => setNorbertEnabled(isPluginEnabled('norbert'));
    syncNorbertState();
    window.addEventListener('ljbPluginRegistryChanged', syncNorbertState);
    return () => window.removeEventListener('ljbPluginRegistryChanged', syncNorbertState);
  }, []);

  const mandatoryStage = useMemo<'nobleTitle' | 'personWrapper' | undefined>(() => {
    if (!norbertEnabled) return undefined;
    if (
      suggestions.some(
        (suggestion) => suggestion.status === 'pending' && suggestion.tag === 'nobleTitle',
      )
    ) {
      return 'nobleTitle';
    }
    if (
      suggestions.some(
        (suggestion) =>
          suggestion.status === 'pending' &&
          suggestion.tag === 'name' &&
          suggestion.attributes?.type === 'personWrapper',
      )
    ) {
      return 'personWrapper';
    }
    return undefined;
  }, [norbertEnabled, suggestions]);

  const visibleSuggestions = useMemo(() => {
    if (mandatoryStage === 'nobleTitle') {
      return suggestions.filter((suggestion) => suggestion.tag === 'nobleTitle');
    }
    if (mandatoryStage === 'personWrapper') {
      return suggestions.filter(
        (suggestion) =>
          suggestion.tag === 'name' && suggestion.attributes?.type === 'personWrapper',
      );
    }
    return suggestions;
  }, [mandatoryStage, suggestions]);

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

  // Norbert's compact noble-title pack needs a small expansion pass before it
  // can produce wrapper candidates. Start it only once the review pane has
  // painted and the browser is idle: it makes the first Apply/Refresh quick
  // without competing with editor startup or the panel's first interaction.
  useEffect(() => {
    if (!active) return;
    const readPack = cachedPackReader();
    if (!readPack) return;
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      void getSession()
        .warmPersonWrapperCandidates(readPack)
        .catch(() => {
          // Optional Norbert packs are allowed to be absent.
        });
    };
    const idle = globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const handle =
      typeof idle.requestIdleCallback === 'function'
        ? idle.requestIdleCallback(warm, { timeout: 1500 })
        : window.setTimeout(warm, 750);
    return () => {
      cancelled = true;
      if (typeof idle.cancelIdleCallback === 'function' && typeof handle === 'number') {
        idle.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, [active, batchId, getSession]);

  useEffect(() => {
    if (!active) {
      setSuggestions([]);
      setNotice(null);
      setApplyDiagnostics(null);
      setApplyDiagSeverity('info');
      dateRecalculate.current = null;
      dateAuthorityCiv.current = null;
      dismissedLocations.current = new Set();
      if (session.current) {
        session.current.clearFocusHighlight();
        void session.current.flushDecisions();
      }
      session.current = null;
      return;
    }

    const batch = takeAutoTaggingBatch();
    dateRecalculate.current = takeDateReviewRecalculate();
    dateAuthorityCiv.current = takeDateAuthorityCiv();
    dismissedLocations.current = new Set();
    setNotice(takeAutoTaggingNotice());
    setApplyDiagnostics(null);
    setApplyDiagSeverity('info');
    setApplied(0);
    setCanRevert(false);
    setAiCurating(false);
    setAiCurateProgress(null);
    setCurateRejectBelow(curateRejectBelowFromSettings(readPersistedValidationSettings()));
    curateAbort.current?.abort();
    curateAbort.current = null;

    let cancelled = false;
    void (async () => {
      try {
        const session = getSession();
        const doc = await session.getDocument();
        const { suggestions: preparedRaw } = prepareSuggestionsForReview(
          doc,
          session.policy,
          batch,
        );
        // Group fully contiguous, canonically-ordered person-wrapper
        // component runs (nationality/roleName/nobleTitle/placeName/persName)
        // into wrapper-candidate suggestions before anything else is shown —
        // Norbert-only, so an inactive plugin leaves the batch untouched.
        const prepared = isPluginEnabled('norbert')
          ? (() => {
              const { groups, ungrouped } = groupWrapperCandidateSuggestions(preparedRaw);
              return groups.length > 0
                ? [...groups.map((group) => group.suggestion), ...ungrouped]
                : preparedRaw;
            })()
          : preparedRaw;
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

        const abort = new AbortController();
        curateAbort.current = abort;
        setAiCurating(true);
        const client = createLlmClientFromSettings(settings);
        await validateSuggestions({
          suggestions: prepared,
          client,
          signal: abort.signal,
          onProgress: (done, total) => {
            if (!cancelled) setAiCurateProgress({ done, total });
          },
          onBatch: (batchResults) => {
            if (cancelled || batchResults.size === 0) return;
            setSuggestions((current) =>
              current.map((s) => {
                const validation = batchResults.get(s.id);
                return validation ? { ...s, aiValidation: validation } : s;
              }),
            );
          },
        });
      } catch (error) {
        console.warn('[auto-tagging] Failed to prepare review batch:', error);
        if (!cancelled) setSuggestions(batch);
      } finally {
        if (!cancelled) {
          setAiCurating(false);
          setAiCurateProgress(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      curateAbort.current?.abort();
      curateAbort.current = null;
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
    // Registers the listener while the pane is active. `getSession` is read inside
    // the handler, not used to decide whether to register, and is redefined every
    // render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (session.current) {
      session.current.clearFocusHighlight();
      void session.current.flushDecisions();
    }
    session.current = null;
    setApplied(0);
    setCanRevert(false);
    exitAutoTaggingReview();
  }, [busy, exitAutoTaggingReview]);

  const handleApply = useCallback(
    (accepted: Suggestion[], rejected: Suggestion[] = []) => {
      if (busy) return;
      if (accepted.length === 0 && rejected.length === 0) return;
      const closeAfterApply = isDateCuratorBatch(accepted) || isDateCuratorBatch(suggestions);
      void (async () => {
        setBusyLabel(accepted.length > 0 ? 'Applying tags…' : 'Updating review…');
        setBusy(true);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        try {
          const result =
            accepted.length > 0
              ? await getSession().apply(accepted, currentUserRules())
              : {
                  applied: 0,
                  diagnostics: undefined,
                  textIntegrityWarning: undefined,
                  personWrapperValidation: undefined,
                };
          // Drop committed and rejected suggestions from the parent docket.
          // Rejected rows never hit the document, but they must leave the queue
          // so Norbert stages (and ordinary review) can advance.
          const droppedIds = new Set([
            ...accepted.map((suggestion) => suggestion.id),
            ...rejected.map((suggestion) => suggestion.id),
          ]);
          for (const suggestion of rejected) {
            dismissedLocations.current.add(suggestionLocationKey(suggestion));
          }
          // Rejecting a wrapper candidate ungroups it: its component
          // suggestions — pulled from the pool when they were grouped —
          // return as ordinary, independently reviewable suggestions rather
          // than being lost with the wrapper.
          const reinstatedMembers = rejected.flatMap(
            (suggestion) => suggestion.compoundMembers ?? [],
          );
          const withoutDropped = (list: Suggestion[]) =>
            list.filter(
              (suggestion) =>
                !droppedIds.has(suggestion.id) &&
                !dismissedLocations.current.has(suggestionLocationKey(suggestion)),
            );
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
          // Reject-only commits must NOT refresh: refresh re-seeds the same
          // noble-title matches under new ids and loops the Norbert stage.
          let nextSuggestions: Suggestion[] | null = null;
          if (result.applied > 0) {
            const readPack = cachedPackReader();
            if (readPack) {
              try {
                const remaining = withoutDropped(suggestions);
                if (mandatoryStage) {
                  // Mandatory Norbert stages must be rebuilt against the live
                  // document after each apply. This removes accepted compound
                  // children from the pool and exposes the next stage only
                  // after the current one has been resolved.
                  const refreshed = await getSession().refreshReviewBatch(remaining, readPack);
                  nextSuggestions = withoutDropped(refreshed.suggestions);
                  if (refreshed.wrapperMatchCount > 0) {
                    setNotice(
                      `${refreshed.wrapperMatchCount} Norbert person-wrapper candidate${refreshed.wrapperMatchCount === 1 ? '' : 's'} found after component tagging.`,
                    );
                  }
                } else {
                  const wrapperBatch = await getSession().runPersonWrapperConcatenation(readPack);
                  if (wrapperBatch.suggestions.length > 0) {
                    const currentDoc = await getSession().getDocument();
                    nextSuggestions = withoutDropped(
                      prepareSuggestionsForReview(currentDoc, getSession().policy, [
                        ...remaining,
                        ...wrapperBatch.suggestions,
                      ]).suggestions,
                    );
                    setNotice(
                      `${wrapperBatch.matchCount} Norbert person-wrapper candidate${wrapperBatch.matchCount === 1 ? '' : 's'} found after component tagging.`,
                    );
                  }
                }
              } catch (error) {
                console.warn('[auto-tagging] Norbert wrapper concatenation failed:', error);
              }
            }
          }
          if (!closeAfterApply || result.applied === 0) {
            setSuggestions((current) => {
              const base = nextSuggestions ?? withoutDropped(current);
              return reinstatedMembers.length > 0 ? [...base, ...reinstatedMembers] : base;
            });
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
            if (session.current) {
              session.current.clearFocusHighlight();
              void session.current.flushDecisions();
            }
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
    [busy, exitAutoTaggingReview, getSession, mandatoryStage, suggestions],
  );

  const handleRefresh = useCallback(() => {
    if (busy || refreshing) return;
    void (async () => {
      setRefreshing(true);
      try {
        const readPack = cachedPackReader();
        if (!readPack) return;
        const result = await getSession().refreshReviewBatch(suggestions, readPack);
        setSuggestions(
          result.suggestions.filter(
            (suggestion) => !dismissedLocations.current.has(suggestionLocationKey(suggestion)),
          ),
        );
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

  const handleDateRecalculate = useCallback(() => {
    const recalculate = dateRecalculate.current;
    if (!recalculate || busy || refreshing) return;
    void (async () => {
      setRefreshing(true);
      try {
        setSuggestions(await recalculate(suggestions));
      } catch (error) {
        console.warn('[auto-tagging] date recalculation failed:', error);
      } finally {
        setRefreshing(false);
      }
    })();
  }, [busy, refreshing, suggestions]);

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
                    suggestions={visibleSuggestions}
                    onApply={handleApply}
                    onFocus={handleFocus}
                    onDecision={handleDecision}
                    onClose={handleClose}
                    onRecalculate={dateRecalculate.current ? handleDateRecalculate : undefined}
                    refreshing={refreshing}
                    authorityCiv={dateAuthorityCiv.current ?? undefined}
                  />
                );
              }
              return (
                <ReviewPanel
                  autoFocus={false}
                  busy={busy}
                  suggestions={visibleSuggestions}
                  onApply={handleApply}
                  onFocus={handleFocus}
                  onDecision={handleDecision}
                  onClose={handleClose}
                  aiValidationEnabled={aiValidationEnabled}
                  aiCurating={aiCurating}
                  aiCurateProgress={aiCurateProgress}
                  curateRejectBelow={curateRejectBelow}
                  onCurateRejectBelowChange={(value) => {
                    setCurateRejectBelow(value);
                    void persistValidationSettings({ curateRejectBelow: value });
                  }}
                  onRefresh={handleRefresh}
                  refreshing={refreshing}
                  mandatoryStage={mandatoryStage}
                />
              );
            })()
          )}
        </Box>
      </Box>
    </>
  );
};
