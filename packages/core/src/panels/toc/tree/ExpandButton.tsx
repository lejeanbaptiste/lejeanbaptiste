import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { IconButton, useTheme, type PaletteMode } from '@mui/material';
import { motion, type Variants } from 'framer-motion';
import React, { MouseEvent, useMemo } from 'react';

type ExpandButtonProps = {
  disabled?: boolean;
  expanded?: boolean;
  onClick: (event: MouseEvent<HTMLElement, globalThis.MouseEvent>) => void;
  selected?: boolean;
};

export const ExpandButton = ({
  disabled = false,
  expanded = false,
  selected = false,
  onClick,
}: ExpandButtonProps) => {
  const { palette } = useTheme();

  const variant: Variants = {
    expanded: { transform: 'rotate(0deg)' },
    collapse: { transform: 'rotate(-90deg)' },
  };

  const inverseThemeMode: PaletteMode = useMemo(
    () => (palette.mode === 'light' ? 'dark' : 'light'),
    [palette.mode],
  );

  return (
    <IconButton disabled={disabled} onClick={onClick} size="small" sx={{ height: 18, width: 18 }}>
      <ExpandMoreRoundedIcon
        component={motion.svg}
        variants={variant}
        initial="collapsed"
        animate={expanded ? 'expanded' : 'collapse'}
        sx={{
          width: 18,
          height: 18,
          color: selected ? palette.primary[inverseThemeMode] : palette.primary[palette.mode],
          opacity: expanded ? 1 : 0.7,
        }}
      />
    </IconButton>
  );
};
