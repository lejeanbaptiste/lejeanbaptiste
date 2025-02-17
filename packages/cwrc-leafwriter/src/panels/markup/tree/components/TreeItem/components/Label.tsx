import {
  Stack,
  SxProps,
  Theme,
  Typography,
  TypographyProps,
  useColorScheme,
  useTheme,
  type PaletteMode,
} from '@mui/material';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useMemo } from 'react';

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
  const theme = useTheme();
  const { mode, systemMode } = useColorScheme();

  const inverseThemeMode: PaletteMode = useMemo(
    () => (mode === 'dark' || (mode === 'system' && systemMode === 'dark') ? 'light' : 'dark'),
    [mode, systemMode],
  );

  const detailsVariant: Variants = {
    show: { x: 0, width: '100%', opacity: 0.4 },
    hide: { x: 10, width: 0, opacity: 0 },
  };

  return (
    <Stack direction="row" alignItems="center" gap={1} overflow="hidden">
      <Typography
        color={selected ? theme.palette.primary[inverseThemeMode] : 'inherit'}
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
