import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoTaggingSession, DisambiguationPanel, type MentionGroup } from '../autoTagging';
import { useActions, useAppState } from '../overmind';
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
  const { t } = useTranslation('LW');
  const active = useAppState().ui.disambiguationReview?.active ?? false;
  const { exitDisambiguationReview } = useActions().ui;
  const [groups, setGroups] = useState<MentionGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const session = useRef<AutoTaggingSession | null>(null);
  const scanGeneration = useRef(0);

  const getSession = useCallback(() => {
    if (!window.writer) throw new Error('Editor not ready');
    session.current ??= new AutoTaggingSession(window.writer);
    return session.current;
  }, []);

  useEffect(() => {
    if (!active) {
      scanGeneration.current += 1;
      setLoading(false);
      setGroups([]);
      setError(null);
      session.current = null;
      return;
    }

    const generation = ++scanGeneration.current;
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
        await activeSession.loadEntities();
        if (generation !== scanGeneration.current) return;

        const scanned = await activeSession.scanMentions();
        if (generation !== scanGeneration.current) return;
        setGroups(scanned);
      } catch (e) {
        if (generation !== scanGeneration.current) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (generation === scanGeneration.current) setLoading(false);
      }
    })();
  }, [active, getSession]);

  useEffect(() => {
    if (!isDesktopApp()) return;
    setDockedReviewMountOpen(
      DOCKED_DISAMBIGUATION_MOUNT_ID,
      active,
      DISAMBIGUATION_PANEL_WIDTH,
    );
    scheduleDesktopEditorRelayout();
    return () => {
      setDockedReviewMountOpen(DOCKED_DISAMBIGUATION_MOUNT_ID, false);
      scheduleDesktopEditorRelayout();
    };
  }, [active]);

  const handleClose = useCallback(() => {
    if (session.current) void session.current.flushDecisions();
    session.current = null;
    exitDisambiguationReview();
  }, [exitDisambiguationReview]);

  if (!active) return null;

  return (
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
          <DisambiguationPanel session={getSession()} groups={groups} />
        )}
      </Box>
    </Box>
  );
};
