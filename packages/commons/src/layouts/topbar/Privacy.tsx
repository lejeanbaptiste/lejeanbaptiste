import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import { IconButton } from '@mui/material';
import { useCookieConsent } from '@src/hooks';
import { motion } from 'framer-motion';
import React, { FC } from 'react';

export const Privacy: FC = () => {
  const { showSettings } = useCookieConsent();

  const handleClick = () => showSettings();

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
      <PrivacyTipIcon fontSize="inherit" />
    </IconButton>
  );
};
