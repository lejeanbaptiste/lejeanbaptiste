import { useTheme } from '@mui/material';
import Box, { BoxProps } from '@mui/material/Box';
import React from 'react';

interface LogoProps extends BoxProps {
  height?: string | number;
  size?: 'large' | 'small';
  variant?: 'horizontal' | 'vertical';
}

export const Logo = ({
  height = 'auto',
  size = 'large',
  variant = 'horizontal',
  ...props
}: LogoProps) => {
  const { mode } = useTheme().palette;

  return (
    <Box display="flex" {...props}>
      <img
        alt="LEAF-Writer"
        height={height}
        src={`/assets/logo/logo-${variant}-${size}-${mode ?? 'light'}.png`}
      />
    </Box>
  );
};
