import { Box, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useAppState } from '../../overmind';
import { useUI } from '../../hooks';

const Header = () => {
  const theme = useTheme();
  const { typeLookup } = useAppState().lookups;
  const { getIcon } = useUI();

  const getEntityIcon = () => {
    if (typeLookup && Object.keys(theme.entity).includes(typeLookup)) {
      const entityType = Object.entries(theme.entity).find(([name]) => name === typeLookup);
      return getIcon(entityType?.[1].icon);
    }
  };

  const Icon = typeLookup && getEntityIcon();

  const color = () => {
    if (!typeLookup) return 'inherent';
    if (typeLookup && Object.keys(theme.entity).includes(typeLookup)) {
      const entityType = Object.entries(theme.entity).find(([name]) => name === typeLookup);
      return entityType?.[1].color.main;
    }
  };

  return (
    <Box display="flex" justifyContent="center" py={2}>
      {Icon && <Icon sx={{ height: 32, width: 32, mr: 0.5, color: color() }} />}
      <Typography sx={{ textTransform: 'capitalize' }} variant="h5">
        Find {typeLookup}
      </Typography>
    </Box>
  );
};

export default Header;
