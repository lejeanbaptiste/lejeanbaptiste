import { Typography, useTheme } from '@mui/material';
import React, { type FC } from 'react';

interface TextEmphasis {
  children: string;
  color?: 'primary' | 'secondary' | 'info' | 'warning' | 'error' | 'inherit';
  disablePadding?: boolean;
  variation?: 'filled' | 'outlined' | 'text';
}

export const TextEmphasis: FC<TextEmphasis> = ({
  color = 'inherit',
  children,
  disablePadding = false,
  variation = 'text',
}) => {
  const { palette } = useTheme();

  const accentColor =
    color === 'inherit'
      ? 'inherit'
      : palette.mode === 'light'
      ? palette[color].dark
      : palette[color].light;

  const textColor = variation === 'filled' ? palette.background.paper : accentColor;

  return (
    <Typography
      component="span"
      sx={{
        mx: disablePadding ? 0 : variation === 'text' ? 0 : 0.5,
        px: variation === 'text' ? 0 : 0.5,
        py: variation === 'text' ? 0 : 0.25,
        backgroundColor: variation === 'filled' ? accentColor : 'inherent',
        borderRadius: 1,
        borderWidth: variation === 'outlined' ? 1 : 0,
        borderStyle: variation === 'outlined' ? 'solid' : 'none',
        borderColor: variation === 'outlined' ? accentColor : 'inherent',
        fontWeight: 700,
        color: textColor,
      }}
      variant="inherit"
    >
      {children}
    </Typography>
  );
};
