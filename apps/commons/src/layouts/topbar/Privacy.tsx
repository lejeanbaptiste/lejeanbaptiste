import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import { IconButton } from '@mui/material';
import { useCookieConsent } from '@src/hooks';
import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const Privacy = () => {
  const { t } = useTranslation();
  const { showSettings } = useCookieConsent();

  const handleClick = () => showSettings();

  const optionVariants: Variants = {
    initial: { y: -100 },
    visible: { y: 0 },
    exit: { y: -100 },
  };

  return (
    <IconButton
      key="darkMode"
      aria-label={t('LWC.commons.privacy')}
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
