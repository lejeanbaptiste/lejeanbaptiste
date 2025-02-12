import Brightness7Icon from '@mui/icons-material/Brightness7';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { IconButton } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const DarkMode = () => {
  const { t } = useTranslation();
  const { darkMode } = useAppState().ui;
  const { setDarkMode } = useActions().ui;

  const switchAppearenceMode = () => {
    const value = !darkMode;
    setDarkMode(value);
  };

  const optionVariants: Variants = {
    initial: { y: -100 },
    visible: { y: 0 },
    exit: { y: -100 },
  };

  return (
    <IconButton
      key="darkMode"
      aria-label={t('LWC.ui.appearance')}
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
