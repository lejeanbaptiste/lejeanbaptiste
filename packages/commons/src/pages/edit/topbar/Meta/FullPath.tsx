import { Icon, IconButton, Stack, Typography } from '@mui/material';
import { getIcon, type IconName } from '@src/icons';
import React from 'react';

type FullPathProps = {
  children: React.ReactNode;
  provider?: string;
  url?: string;
};

export const FullPath = ({ children, provider, url }: FullPathProps) => {
  return (
    <Stack direction="row" alignItems="center" sx={{ overflow: 'hidden' }} spacing={1}>
      {provider && (
        <Icon component={getIcon(provider as IconName)} sx={{ width: 14, height: 14 }} />
      )}
      <Typography sx={{ cursor: 'default' }} variant="caption">
        {children}
      </Typography>
      {url && (
        <IconButton
          size="small"
          sx={{ width: 20, height: 20, borderRadius: 1 }}
          href={url}
          target="_blank"
        >
          <Icon component={getIcon('externalLink')} sx={{ width: 12, height: 12 }} />
        </IconButton>
      )}
    </Stack>
  );
};
