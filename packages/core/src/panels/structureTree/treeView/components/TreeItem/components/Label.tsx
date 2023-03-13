import { Stack, Typography, useTheme, type PaletteMode } from '@mui/material';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import React, { useMemo } from 'react';

type LabelProps = {
  children: React.ReactNode;
  fullName?: string;
  selected?: boolean;
  showFullName?: boolean;
};

export const Label = ({
  children,
  fullName,
  selected = false,
  showFullName = true,
}: LabelProps) => {
  const { palette } = useTheme();

  const inverseThemeMode: PaletteMode = useMemo(
    () => (palette.mode === 'light' ? 'dark' : 'light'),
    [palette.mode]
  );

  const fullNameVariant: Variants = {
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
      >
        {children}
      </Typography>

      <AnimatePresence>
        {fullName && showFullName && (
          <Typography
            component={motion.span}
            variants={fullNameVariant}
            initial="hide"
            exit="hide"
            animate="show"
            sx={{
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
            variant="caption"
          >
            {` ${fullName}`}
          </Typography>
        )}
      </AnimatePresence>
    </Stack>
  );
};
