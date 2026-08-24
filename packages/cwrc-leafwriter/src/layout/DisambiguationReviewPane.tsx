import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoTaggingSession, DisambiguationPanel, type MentionGroup } from '../autoTagging';
import { runAuthorityPrefetch, type AuthorityPrefetchHandle } from '../autoTagging/authorityPrefetch';
import { stopBackgroundAuthorityPrefetch } from '../autoTagging/backgroundAuthorityPrefetch';
import { runDisambiguationAiWarmPass } from '../autoTagging/disambiguationAiWarmPass';
import { isAiUiFeatureEnabled } from '../autoTagging/aiUiFeatures';
import {
  aiApiSettingsFromDesktop,
  createLlmClientFromSettings,
  isAiSuggestReady,
} from '../autoTagging/llmClientFromSettings';
import {
  getActiveAiPromptProfile,
  readAiPromptProfilesFromDesktop,
} from '../autoTagging/aiPromptProfiles';
import {
  finishAiRunProgress,
  startAiRunProgress,
  updateAiRunProgress,
} from '../autoTagging/aiRunProgress';
import { useActions, useAppState } from '../overmind';
import { DockedResizeHandle, useStoredPanelWidth } from './DockedResizeHandle';
import {
  DOCKED_DISAMBIGUATION_MOUNT_ID,
  scheduleDesktopEditorRelayout,
  setDockedReviewMountOpen,
} from './dockedReviewLayout';

/** Default width when docked beside the editor (desktop shell). */
export const DISAMBIGUATION_PANEL_WIDTH = 320;

const isDesktopApp = () => typeof window !== 'undefined' && !!window.electronAPI;

/**
 * Docked disambiguation walk. Shown only while active — like auto-tagging review,
 * not a permanent sidebar panel.
 */
export const DisambiguationReviewPane = () => {
  const { t, i18n } = useTranslation('LW');
  const active = useAppState().ui.disambiguationReview?.active ?? false;
  const aiCuration = useAppState().ui.disambiguationReview?.aiCuration ?? false;
  const { exitDisambiguationReview } = useActions().ui;
  const [groups, setGroups] = useState<MentionGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const session = useRef<AutoTaggingSession | null>(null);
  const scanGeneration = useRef(0);
  const prefetch = useRef<AuthorityPrefetchHandle | null>(null);
  const warmPassAbort = useRef<AbortController | null>(null);
  const stopWarmPass = useCallback(() => {
    warmPassAbort.current?.abort();
    warmPassAbort.current = null;
    finishAiRunProgress();
  }, []);
  const [panelWidth, setPanelWidth] = useStoredPanelWidth(
    'lw.disambiguation.panelWidth',
    DISAMBIGUATION_PANEL_WIDTH,
  );

  const getSession = useCallback(() => {
    if (!window.writer) throw new Error('Editor not ready');
    session.current ??= new AutoTaggingSession(window.writer);
    return session.current;
  }, []);

  useEffect(() => {
    if (!active) {
      scanGeneration.current += 1;
      prefetch.current?.stop();
      prefetch.current = null;
      stopWarmPass();
      setLoading(false);
      setGroups([]);
      setError(null);
      if (session.current) void session.current.flushDecisions();
      session.current = null;
      return;
    }

    const generation = ++scanGeneration.current;
    prefetch.current?.stop();
    prefetch.current = null;
    // The panel's own prefetch (below) covers the same groups at full pace,
    // and the two sessions would otherwise race the same network throttle.
    stopBackgroundAuthorityPrefetch();
    void (async () => {
      setLoading(true);
      setError(null);
      setGroups([]);
      try {
        const activeSession = getSession();
        if (!activeSession.entityStore) {
          setError('Open a desktop project with an entity database configured.');
          return;
        }
        const scanned = await activeSession.scanMentions({ includeResolved: true });
        if (generation !== scanGeneration.current) return;
        setGroups(scanned);
        prefetch.current = runAuthorityPrefetch(activeSession, scanned);
      } catch (e) {
        if (generation !== scanGeneration.current) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (generation === scanGeneration.current) setLoading(false);
      }
    })();
    // `stopWarmPass` is called by the scan below but is redefined every render;
    // naming it would restart the scan continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, getSession]);

  // When "Stream AI results" is off, warm the AI ranking cache for every
  // pending group in the background — the panel is already open and usable
  // while this runs, it just makes per-mention navigation feel instant once
  // it catches up. Re-fires if the AI toggle flips after groups are loaded.
  useEffect(() => {
    stopWarmPass();
    if (!active || groups.length === 0 || !aiCuration) return;
    if (!isAiUiFeatureEnabled('disambiguationCurate')) return;
    const settings = aiApiSettingsFromDesktop();
    if (!settings || settings.streamResults !== false || !isAiSuggestReady(settings)) return;

    const controller = new AbortController();
    warmPassAbort.current = controller;
    startAiRunProgress('AI pre-caching', () => controller.abort());
    void (async () => {
      const profiles = await readAiPromptProfilesFromDesktop();
      if (controller.signal.aborted) return;
      const activeSession = getSession();
      await runDisambiguationAiWarmPass(activeSession, groups, {
        client: createLlmClientFromSettings(settings),
        promptProfile: getActiveAiPromptProfile(profiles),
        preferredLanguage: i18n.language,
        signal: controller.signal,
        onProgress: (done, total) => updateAiRunProgress(done, total),
      });
    })().finally(() => {
      if (warmPassAbort.current === controller) stopWarmPass();
    });

    return () => controller.abort();
  }, [active, aiCuration, getSession, groups, i18n.language, stopWarmPass]);

  // Width updates re-run only the open path so a drag never flashes the
  // mount closed; the close cleanup is keyed on `active` alone.
  useEffect(() => {
    if (!isDesktopApp() || !active) return;
    setDockedReviewMountOpen(DOCKED_DISAMBIGUATION_MOUNT_ID, true, panelWidth);
    scheduleDesktopEditorRelayout();
  }, [active, panelWidth]);

  useEffect(() => {
    if (!isDesktopApp() || !active) return;
    return () => {
      setDockedReviewMountOpen(DOCKED_DISAMBIGUATION_MOUNT_ID, false);
      scheduleDesktopEditorRelayout();
    };
  }, [active]);

  const handleClose = useCallback(() => {
    prefetch.current?.stop();
    prefetch.current = null;
    stopWarmPass();
    if (session.current) void session.current.flushDecisions();
    session.current = null;
    exitDisambiguationReview();
  }, [exitDisambiguationReview, stopWarmPass]);

  if (!active) return null;

  return (
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
          {t('Disambiguate')}
        </Typography>
        <Tooltip title={t('Close')}>
          <IconButton size="small" onClick={handleClose} aria-label={t('Close disambiguation')}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <Box sx={{ px: 0.75, py: 0.5 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Scanning…
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {error && (
          <Alert severity="warning" sx={{ mx: 0.75, my: 0.5, py: 0 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && groups.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, py: 0.5 }}>
            No tagged mentions need disambiguation in this document.
          </Typography>
        )}

        {!loading && groups.length > 0 && (
          <DisambiguationPanel
            session={getSession()}
            groups={groups}
            aiCuration={aiCuration}
          />
        )}
      </Box>
    </Box>
  );
};
