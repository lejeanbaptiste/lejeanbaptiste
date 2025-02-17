import BlockIcon from '@mui/icons-material/Block';
import { Stack } from '@mui/material';
import { motion, type Variants } from 'motion/react';

const itemVariants: Variants = {
  hidden: { height: 0 },
  show: { height: 52, transition: { delay: 0.3 } },
};

export const NoResultItem = () => {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      height={52}
      component={motion.div}
      variants={itemVariants}
      initial="hidden"
      animate="show"
      exit="hidden"
      overflow="hidden"
    >
      <BlockIcon
        component={motion.svg}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.5, scale: 1 }}
        transition={{ delay: 0.4 }}
        sx={{ height: 24, width: 24, opacity: 0.5 }}
      />
    </Stack>
  );
};
