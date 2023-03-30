import { Box, Link, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LatestCommit } from '../../../../types/Provider';

interface ContentDetailsProps {
  latestCommit: LatestCommit;
}

export const ContentDetails = ({ latestCommit }: ContentDetailsProps) => {
  const { t } = useTranslation();
  return (
    <Box data-testid="content-details" pt={0.25}>
      <Typography paragraph variant="caption">
        {t('Last_Modified')}:{' '}
        <Typography color="text.secondary" title={latestCommit.date} variant="caption">
          {latestCommit.relativeDate} {t('by')}{' '}
        </Typography>
        <Typography
          color="text.secondary"
          component={Link}
          href={`mailto:${latestCommit.authorEmail}`}
          title={`${latestCommit.authorName} (${latestCommit.authorEmail})`}
          underline="hover"
          variant="caption"
        >
          {latestCommit.authorName}
        </Typography>
      </Typography>
      <Typography paragraph variant="caption">
        {t('Message')}:{' '}
        <Typography color="text.secondary" data-testid="message" variant="caption">
          {latestCommit.message}{' '}
        </Typography>
        <Typography
          color="text.secondary"
          component={Link}
          href={latestCommit.html_url}
          rel="noreferrer"
          sx={{ ':before': { content: '"("' }, ':after': { content: '")"' } }}
          target="_blank"
          title={latestCommit.html_url}
          underline="hover"
          variant="caption"
        >
          {t('view_source')}
        </Typography>
      </Typography>
    </Box>
  );
};
