import { Box, Button, Typography } from '@mui/material';
import React, { FC } from 'react';

interface CrumbProps {
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  disabled?: boolean;
  label?: string;
  level: number;
  name?: string;
  onClick: (level?: number) => void;
}

const Crumb: FC<CrumbProps> = ({
  color = 'inherit',
  disabled = false,
  label,
  level,
  name,
  onClick,
}) => {
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
    </Box>
  );
};

export default Crumb;
