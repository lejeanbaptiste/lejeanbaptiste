import { Box } from '@mui/material';
import React from 'react';

interface BadgeProps {
  count?: number;
}

const Badge = ({ count }: BadgeProps) => {
  return (
    <Box
      sx={{
        position: 'relative',
        minWidth: 16,
        height: 18,
        marginLeft: 0.5,
        paddingLeft: 0.25,
        paddingRight: 0.25,
        borderRadius: 0.5,
        lineHeight: '1.2rem',
      }}
    >
      {count}
    </Box>
  );
};

export default Badge;
