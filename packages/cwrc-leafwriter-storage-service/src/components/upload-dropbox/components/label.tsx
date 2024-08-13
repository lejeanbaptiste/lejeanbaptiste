import { Typography, type SxProps } from '@mui/material';
import { motion, type Variants } from 'framer-motion';

type LabelProps = {
  children: React.ReactNode;
  show?: boolean;
  sx?: SxProps;
};

export const Label = ({ children, show = false, sx }: LabelProps) => {
  const variantsLabel: Variants = {
    show: { height: 'auto', width: 'fit-content', y: 0, opacity: 1 },
    hide: { height: 0, width: 'fit-content', y: 30, opacity: 0 },
    exit: { height: 0, width: 0, y: -30, opacity: 0 },
  };

  return (
    <Typography
      overflow="hidden"
      noWrap
      sx={sx}
      component={motion.span}
      variants={variantsLabel}
      animate={show ? 'show' : 'hide'}
      initial="hide"
      exit="exit"
    >
      {children}
    </Typography>
  );
};
