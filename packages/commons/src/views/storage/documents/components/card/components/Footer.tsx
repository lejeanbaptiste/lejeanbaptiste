import { Icon, Stack, Typography } from '@mui/material';
import { getIcon, type IconName } from '@src/icons';
import React from 'react';

interface FooterProps {
  icon: IconName;
  lastDate?: string;
  path?: string;
}

export const Footer = ({ icon, lastDate, path }: FooterProps) => (
  <Stack
    direction="row"
    justifyContent="space-between"
    flexWrap="wrap"
    px={1}
    sx={{ bgcolor: ({ palette }) => palette.action.hover }}
  >
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ height: 22, overflow: 'hidden' }}>
      <Icon component={getIcon(icon)} sx={{ width: 14, height: 14 }} />
      {path && <Typography variant="caption">{path}</Typography>}
    </Stack>
    {lastDate && (
      <Typography variant="caption" sx={{ opacity: 0.85 }}>
        {lastDate}
      </Typography>
    )}
  </Stack>
);
