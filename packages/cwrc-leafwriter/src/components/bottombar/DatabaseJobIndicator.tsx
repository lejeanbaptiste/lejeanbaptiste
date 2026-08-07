import CloseIcon from '@mui/icons-material/Close';
import { IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { useSyncExternalStore } from 'react';
import {
  getDatabaseJobProgress,
  subscribeDatabaseJobProgress,
} from '../../autoTagging/databaseJobProgress';

/** Bottom-bar progress for Database Window jobs that outlive the DB view. */
export const DatabaseJobIndicator = () => {
  const progress = useSyncExternalStore(subscribeDatabaseJobProgress, getDatabaseJobProgress);
  if (!progress.active) return null;
  const determinate = progress.total > 0;
  const caption = progress.detail
    ? `${progress.label} · ${progress.detail}`
    : `${progress.label}…`;

  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0, maxWidth: 360 }}>
      <Typography
        variant="caption"
        sx={{ color: 'text.disabled', fontSize: '0.7rem' }}
        noWrap
        title={caption}
      >
        {caption}
        {determinate ? ` ${progress.done}/${progress.total}` : ''}
      </Typography>
      <LinearProgress
        variant={determinate ? 'determinate' : 'indeterminate'}
        value={determinate ? (progress.done / progress.total) * 100 : undefined}
        sx={{ width: 56, height: 3, borderRadius: 1, opacity: 0.5, flexShrink: 0 }}
        color="inherit"
      />
      {progress.cancel && (
        <Tooltip title="Cancel database job">
          <IconButton
            aria-label="Cancel database job"
            onClick={progress.cancel}
            size="small"
            sx={{ color: 'text.disabled', p: 0.125 }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
};
