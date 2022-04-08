import { Box, Link, Typography } from '@mui/material';
import React, { FC } from 'react';
import type { ILatestCommit } from '../../@types/Provider';

interface ContentDetailsProps {
  latestCommit: ILatestCommit;
}

const ContentDetails: FC<ContentDetailsProps> = ({ latestCommit }) => {
  return (
    <Box pt={0.25}>
      <Typography component="p" variant="caption">
        Last Modified:{' '}
        <Typography color="text.secondary" title={latestCommit.date} variant="caption">
          {latestCommit.relativeDate} by{' '}
        </Typography>
        <Typography
          color="text.secondary"
          component={Link}
          href={`mailto:${latestCommit.authorEmail}`}
          title={`${latestCommit.authorName}(${latestCommit.authorEmail})`}
          underline="hover"
          variant="caption"
        >
          {latestCommit.authorName}
        </Typography>
      </Typography>
      <Typography component="p" variant="caption">
        Message:{' '}
        <Typography color="text.secondary" variant="caption">
          {latestCommit.message}{' '}
        </Typography>
        <Typography
          color="text.secondary"
          component={Link}
          href={latestCommit.html_url}
          rel="noreferrer"
          sx={{
            ':before': { content: '"("' },
            ':after': { content: '")"' },
          }}
          target="_blank"
          title={latestCommit.html_url}
          underline="hover"
          variant="caption"
        >
          view source
        </Typography>
      </Typography>
    </Box>
  );
};

export default ContentDetails;
