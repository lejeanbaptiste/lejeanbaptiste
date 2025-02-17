import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { IconButton, useColorScheme, useTheme, type PaletteMode } from '@mui/material';
import { motion, type Variants } from 'motion/react';
import { MouseEvent, useMemo } from 'react';

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
  const theme = useTheme();
  const { mode, systemMode } = useColorScheme();

  const variant: Variants = {
    expanded: { transform: 'rotate(0deg)' },
    collapse: { transform: 'rotate(-90deg)' },
  };

  const inverseThemeMode: PaletteMode = useMemo(
    () => (mode === 'dark' || (mode === 'system' && systemMode === 'dark') ? 'light' : 'dark'),
    [mode, systemMode],
  );

  return (
    <IconButton disabled={disabled} onClick={onClick} size="small" sx={{ height: 18, width: 18 }}>
      <ExpandMoreRoundedIcon
        component={motion.svg}
        variants={variant}
        initial="collapsed"
        animate={expanded ? 'expanded' : 'collapse'}
        sx={[
          { width: 18, height: 18, opacity: 0.7, color: theme.palette.primary[theme.palette.mode] },
          selected && { color: theme.palette.primary[inverseThemeMode] },
          expanded && { opacity: 1 },
        ]}
      />
    </IconButton>
  );
};
