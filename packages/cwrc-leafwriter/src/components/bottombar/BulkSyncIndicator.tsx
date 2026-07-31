import CloseIcon from '@mui/icons-material/Close';
import { IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { useSyncExternalStore } from 'react';
import {
  getBulkSyncProgress,
  subscribeBulkSyncProgress,
} from '../../autoTagging/bulkSyncProgress';

/** Compact bottom-bar progress for the background project↔central bulk sync. */
export const BulkSyncIndicator = () => {
  const progress = useSyncExternalStore(subscribeBulkSyncProgress, getBulkSyncProgress);
  if (!progress.active) return null;
  const determinate = progress.total > 0;
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
        {progress.label}…{determinate ? ` ${progress.done}/${progress.total}` : ''}
      </Typography>
      <LinearProgress
        variant={determinate ? 'determinate' : 'indeterminate'}
        value={determinate ? (progress.done / progress.total) * 100 : undefined}
        sx={{ width: 56, height: 3, borderRadius: 1, opacity: 0.5 }}
        color="inherit"
      />
      {progress.cancel && (
        <Tooltip title="Cancel synchronisation">
          <IconButton aria-label="Cancel synchronisation" onClick={progress.cancel} size="small" sx={{ color: 'text.disabled', p: 0.125 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
};
