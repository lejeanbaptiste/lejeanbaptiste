import SettingsIcon from '@mui/icons-material/Settings';
import { IconButton } from '@mui/material';
import { useLeafWriter } from '@src/views/edit/useLeafWriter';
import { motion } from 'framer-motion';
import React, { type FC } from 'react';

export const Settings: FC = () => {
  const { leafWriter } = useLeafWriter();

  const handleClick = () => {
    leafWriter?.showSettingsDialog();
  };

  const optionVariants = {
    initial: { y: -100 },
    visible: { y: 0 },
    exit: { y: -100 },
  };

  return (
    <IconButton
      key="darkMode"
      component={motion.button}
      variants={optionVariants}
      initial="initial"
      animate="visible"
      exit="exit"
      onClick={handleClick}
      size="small"
    >
      <SettingsIcon fontSize="inherit" />
    </IconButton>
  );
};
