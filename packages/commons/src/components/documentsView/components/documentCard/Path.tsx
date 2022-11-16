import { Icon, Stack, Typography } from '@mui/material';
import { getIcon } from '@src/assets/icons';
import React, { type FC } from 'react';

interface PathProps {
  owner: string;
  path?: string;
  provider: string;
  repo: string;
}

export const Path: FC<PathProps> = ({ owner, path, provider, repo }) => {
  let fullPath = `${owner}: ${repo}`;
  fullPath = path ? `${fullPath}/${path}` : fullPath;

  return (
    <Stack
      justifyContent="space-between"
      px={1}
      sx={{
        backgroundColor: ({ palette }) => palette.action.hover,
      }}
    >
      <Stack direction="row" alignItems="center" gap={0.5} sx={{ height: 22, overflow: 'hidden' }}>
        <Icon component={getIcon(provider)} sx={{ width: 14, height: 14 }} />
        <Typography variant="caption">{fullPath}</Typography>
      </Stack>
    </Stack>
  );
};
