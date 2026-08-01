import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, LinearProgress, Stack, Typography } from '@mui/material';
import { useCallback, useRef, useSyncExternalStore } from 'react';

export type BackgroundJobProgress = {
  label: string;
  /** Completed units; 0 + total 0 → indeterminate. */
  done: number;
  total: number;
  detail?: string;
};

type Listener = () => void;

/**
 * External store for job progress so ticks re-render only the banner,
 * not the whole Database Window (entity list, cards, etc.).
 */
function createJobStore() {
  let job: BackgroundJobProgress | null = null;
  const listeners = new Set<Listener>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return job;
    },
    begin(label: string, total = 0) {
      job = { label, done: 0, total };
      emit();
    },
    update(patch: Partial<BackgroundJobProgress>) {
      if (!job) return;
      job = { ...job, ...patch };
      emit();
    },
    end() {
      job = null;
      emit();
    },
  };
}

const jobStore = createJobStore();

/**
 * Fixed bottom-right progress chip for long Database Window jobs
 * (scan / harvest / backfill). Non-modal so the rest of the UI stays usable.
 */
export const BackgroundJobBanner = ({ onCancel }: { onCancel?: () => void }) => {
  const job = useSyncExternalStore(jobStore.subscribe, jobStore.getSnapshot);
  if (!job) return null;
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

/** Hook: running flag for disabling buttons; progress lives in the external store. */
export function useBackgroundJob() {
  const abortRef = useRef<AbortController | null>(null);
  // Re-render parent only when a job starts or ends (not on every progress tick).
  const running = useSyncExternalStore(
    jobStore.subscribe,
    () => jobStore.getSnapshot() !== null,
  );

  const beginJob = useCallback((label: string, total = 0) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    jobStore.begin(label, total);
    return controller;
  }, []);

  const updateJob = useCallback((patch: Partial<BackgroundJobProgress>) => {
    jobStore.update(patch);
  }, []);

  const endJob = useCallback(() => {
    abortRef.current = null;
    jobStore.end();
  }, []);

  const cancelJob = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { jobRunning: running, beginJob, updateJob, endJob, cancelJob };
}

/** Yield so React can paint progress updates during long loops. */
export const yieldToUi = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
