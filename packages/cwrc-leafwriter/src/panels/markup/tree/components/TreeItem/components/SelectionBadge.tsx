import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import { Stack, useTheme } from '@mui/material';
import { AnimatePresence, motion, type Variants } from 'framer-motion';

type SelectionBadgeProps = {
  contentsOnly?: boolean;
};

export const SelectionBadge = ({ contentsOnly = false }: SelectionBadgeProps) => {
  const theme = useTheme();

  const selectionStateVariant: Variants = {
    show: { x: 0, opacity: 1, display: 'flex' },
    hide: { x: -10, opacity: 0, display: 'none' },
  };

  const arrowLeftVariant: Variants = {
    tag: { transform: 'rotate(0deg)' },
    content: { transform: 'rotate(180deg)' },
  };

  const arrowRightVariant: Variants = {
    tag: { transform: 'rotate(180deg)' },
    content: { transform: 'rotate(0deg)' },
  };

  return (
    <AnimatePresence>
      <Stack
        direction="row"
        sx={{
          backgroundColor: theme.palette.primary[theme.palette.mode],
          borderRadius: 1,
        }}
        component={motion.div}
        variants={selectionStateVariant}
        initial="hide"
        animate="show"
        exit="hide"
      >
        <ChevronLeftRoundedIcon
          animate={contentsOnly ? 'content' : 'tag'}
          component={motion.svg}
          sx={{
            width: 12,
            height: 12,
            color: theme.palette.getContrastText(theme.palette.primary[theme.palette.mode]),
          }}
          variants={arrowLeftVariant}
        />
        <ChevronLeftRoundedIcon
          animate={contentsOnly ? 'content' : 'tag'}
          component={motion.svg}
          sx={{
            width: 12,
            height: 12,
            marginLeft: -0.75,
            color: theme.palette.getContrastText(theme.palette.primary[theme.palette.mode]),
          }}
          variants={arrowRightVariant}
        />
      </Stack>
    </AnimatePresence>
  );
};
