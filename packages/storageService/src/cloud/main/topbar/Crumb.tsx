import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { Box, Button, Stack, Typography } from '@mui/material';
import React from 'react';

interface CrumbProps {
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  disabled?: boolean;
  label?: string;
  level: number;
  name?: string;
  onClick: (level?: number) => void;
  writePermission?: boolean;
}

export const Crumb = ({
  color = 'inherit',
  disabled = false,
  label,
  level,
  name,
  onClick,
  writePermission
}: CrumbProps) => {
  const handleClick = () => onClick(level);

  return (
    <Box>
      {label && (
        <Box>
          <Typography
            px={1.1}
            fontSize="0.55rem"
            letterSpacing="0.065rem"
            sx={{ textTransform: 'uppercase' }}
          >
            {label}
          </Typography>
        </Box>
      )}
      <Stack direction="row" alignItems="flex-end">
        {disabled ? (
          <Typography mt="1px" px={1} py={0.25} fontSize="0.875rem" color={color}>
            {name}
          </Typography>
        ) : (
          <Button
            color={color}
            onClick={handleClick}
            sx={{ minWidth: 0, py: 0, textTransform: 'none' }}
          >
            {name}
          </Button>
        )}
        {writePermission && <AdminPanelSettingsIcon sx={{ width: 16, height: 16, mb: 0.5 }} />}
      </Stack>
    </Box>
  );
};
