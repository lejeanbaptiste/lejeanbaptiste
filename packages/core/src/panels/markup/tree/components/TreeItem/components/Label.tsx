import {
  Stack,
  SxProps,
  Theme,
  Typography,
  TypographyProps,
  useTheme,
  type PaletteMode,
} from '@mui/material';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import React, { useMemo } from 'react';

interface LabelProps extends TypographyProps {
  children: React.ReactNode;
  details?: string;
  detailsSx?: SxProps<Theme>;
  selected?: boolean;
}

export const Label = ({
  children,
  details,
  detailsSx = {},
  selected = false,
  ...props
}: LabelProps) => {
  const { palette } = useTheme();

  const inverseThemeMode: PaletteMode = useMemo(
    () => (palette.mode === 'light' ? 'dark' : 'light'),
    [palette.mode],
  );

  const detailsVariant: Variants = {
    show: { x: 0, width: '100%', opacity: 0.4 },
    hide: { x: 10, width: 0, opacity: 0 },
  };

  return (
    <Stack direction="row" alignItems="center" gap={1} overflow="hidden">
      <Typography
        color={selected ? palette.primary[inverseThemeMode] : 'inherit'}
        fontWeight={selected ? 700 : 500}
        variant="caption"
        sx={{ flexGrow: 1 }}
        {...props}
      >
        {children}
      </Typography>

      <AnimatePresence>
        {details && (
          <Typography
            component={motion.span}
            variants={detailsVariant}
            initial="hide"
            exit="hide"
            animate="show"
            overflow="hidden"
            sx={{
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              ...detailsSx,
            }}
            variant="caption"
          >
            {` ${details}`}
          </Typography>
        )}
      </AnimatePresence>
    </Stack>
  );
};
