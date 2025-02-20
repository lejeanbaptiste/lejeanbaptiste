import SettingsIcon from '@mui/icons-material/Settings';
import { IconButton } from '@mui/material';
import { leafwriterAtom } from '@src/jotai';
import { useAtomValue } from 'jotai';
import { motion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';

export const Settings = () => {
  const { t } = useTranslation();
  const leafWriter = useAtomValue(leafwriterAtom);

  const handleClick = () => {
    leafWriter?.showSettingsDialog();
  };

  const optionVariants: Variants = {
    initial: { y: -100 },
    visible: { y: 0 },
    exit: { y: -100 },
  };

  return (
    <IconButton
      key="darkMode"
      aria-label={t('LWC.commons.settings')}
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
