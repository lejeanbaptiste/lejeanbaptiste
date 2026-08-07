import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, LinearProgress, Stack, Typography } from '@mui/material';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
  finishDatabaseJobProgress,
  getDatabaseJobProgress,
  startDatabaseJobProgress,
  subscribeDatabaseJobProgress,
  updateDatabaseJobProgress,
  type DatabaseJobProgress,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/databaseJobProgress';

export type BackgroundJobProgress = {
  label: string;
  /** Completed units; 0 + total 0 → indeterminate. */
  done: number;
  total: number;
  detail?: string;
};

/**
 * Fixed bottom-right progress chip for long Database Window jobs
 * (scan / harvest / backfill). Non-modal so the rest of the UI stays usable.
 * Progress also mirrors into the editor BottomBar via {@link databaseJobProgress}.
 */
export const BackgroundJobBanner = ({ onCancel }: { onCancel?: () => void }) => {
  const job = useSyncExternalStore(subscribeDatabaseJobProgress, getDatabaseJobProgress);
  if (!job.active) return null;
  const determinate = job.total > 0;
  const percent = determinate ? Math.min(100, (job.done / job.total) * 100) : undefined;

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        zIndex: 30,
        minWidth: 260,
        maxWidth: 360,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: 3,
        px: 1.5,
        py: 1,
      }}
    >
      <Stack spacing={0.75}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {job.label}
            {determinate ? ` · ${job.done}/${job.total}` : '…'}
          </Typography>
          {onCancel && (
            <IconButton size="small" aria-label="Cancel" onClick={onCancel} sx={{ p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Stack>
        {job.detail && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {job.detail}
          </Typography>
        )}
        <LinearProgress
          variant={determinate ? 'determinate' : 'indeterminate'}
          value={percent}
          sx={{ height: 4, borderRadius: 1 }}
        />
      </Stack>
    </Box>
  );
};

/** Hook: running flag for disabling buttons; progress lives in the global store. */
export function useBackgroundJob() {
  const abortRef = useRef<AbortController | null>(null);
  // Re-render parent only when a job starts or ends (not on every progress tick).
  const running = useSyncExternalStore(
    subscribeDatabaseJobProgress,
    () => getDatabaseJobProgress().active,
  );

  const beginJob = useCallback((label: string, total = 0) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Cancel stays on the global store so the editor BottomBar can abort after
    // DatabaseWindow unmounts when the user switches views.
    startDatabaseJobProgress(label, () => controller.abort(), total);
    return controller;
  }, []);

  const updateJob = useCallback((patch: Partial<BackgroundJobProgress>) => {
    const next: Partial<Pick<DatabaseJobProgress, 'done' | 'total' | 'label' | 'detail'>> = {};
    if (patch.done != null) next.done = patch.done;
    if (patch.total != null) next.total = patch.total;
    if (patch.label != null) next.label = patch.label;
    if (patch.detail !== undefined) next.detail = patch.detail ?? '';
    updateDatabaseJobProgress(next);
  }, []);

  const endJob = useCallback(() => {
    abortRef.current = null;
    finishDatabaseJobProgress();
  }, []);

  const cancelJob = useCallback(() => {
    abortRef.current?.abort();
    getDatabaseJobProgress().cancel?.();
  }, []);

  return { jobRunning: running, beginJob, updateJob, endJob, cancelJob };
}

/** Yield so React can paint progress updates during long loops. */
export const yieldToUi = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
