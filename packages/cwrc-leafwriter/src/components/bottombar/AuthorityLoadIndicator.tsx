import { LinearProgress, Stack, Typography } from '@mui/material';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAuthorityLoadProgress,
  subscribeAuthorityLoadProgress,
} from '../../autoTagging/authorityLoadProgress';

/**
 * Unobtrusive bottom-bar indicator for background authority-asset activity:
 * pack files streaming in from disk, or the disambiguation prefetcher working
 * through mention groups. Renders nothing when idle.
 */
export const AuthorityLoadIndicator = () => {
  const { t } = useTranslation();
  const progress = useSyncExternalStore(subscribeAuthorityLoadProgress, getAuthorityLoadProgress);

  const prefetching = progress.prefetchTotal > 0;
  const reading = progress.activePackReads > 0;
  if (!prefetching && !reading) return null;

  const label = prefetching
    ? `${t('LW.Loading authorities')}… ${progress.prefetchDone}/${progress.prefetchTotal}`
    : `${t('LW.Loading authorities')}…`;

  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
        {label}
      </Typography>
      <LinearProgress
        variant={prefetching ? 'determinate' : 'indeterminate'}
        value={prefetching ? (progress.prefetchDone / progress.prefetchTotal) * 100 : undefined}
        sx={{
          width: 56,
          height: 3,
          borderRadius: 1,
          opacity: 0.5,
          '& .MuiLinearProgress-bar': { transition: 'transform 0.4s linear' },
        }}
        color="inherit"
      />
    </Stack>
  );
};
