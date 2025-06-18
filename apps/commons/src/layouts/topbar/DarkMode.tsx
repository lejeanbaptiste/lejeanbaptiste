import Brightness7Icon from '@mui/icons-material/Brightness7';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { IconButton } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { useActions, useAppState } from '@src/overmind';
import { motion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';

export const DarkMode = () => {
  const { t } = useTranslation();
  const { themeAppearance } = useAppState().ui;
  const { setThemeAppearance } = useActions().ui;

  const { setMode } = useColorScheme();

  const switchAppearenceMode = () => {
    const value = themeAppearance === 'dark' ? 'light' : 'dark';
    setMode(value);
    setThemeAppearance(value);
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
      {themeAppearance === 'dark' ? (
        <DarkModeIcon fontSize="inherit" />
      ) : (
        <Brightness7Icon fontSize="inherit" />
      )}
    </IconButton>
  );
};
