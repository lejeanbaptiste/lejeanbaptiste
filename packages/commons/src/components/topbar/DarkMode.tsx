import Brightness7Icon from '@mui/icons-material/Brightness7';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { IconButton } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { motion } from 'framer-motion';
import React, { FC } from 'react';

const DarkMode: FC = () => {
  const { darkMode } = useAppState();
  const { setDarkMode } = useActions();

  const switchAppearenceMode = () => {
    const value = !darkMode;
    setDarkMode(value);
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
      onClick={switchAppearenceMode}
      size="small"
    >
      {darkMode ? <DarkModeIcon fontSize="inherit" /> : <Brightness7Icon fontSize="inherit" />}
    </IconButton>
  );
};

export default DarkMode;
