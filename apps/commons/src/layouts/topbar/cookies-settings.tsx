import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import { IconButton } from '@mui/material';
import { useCookieConsent } from '@src/hooks';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

export const CookiesSettings = () => {
  const { t } = useTranslation();
  const { showSettings } = useCookieConsent();

  return (
    <IconButton
      key="darkMode"
      aria-label={t('LWC.commons.cookies settings')}
      component={motion.button}
      onClick={() => showSettings()}
      size="small"
      initial="initial"
      animate="visible"
      variants={{
        initial: { y: -100 },
        visible: { y: 0 },
        exit: { y: -100 },
      }}
      exit="exit"
    >
      <PrivacyTipIcon fontSize="inherit" />
    </IconButton>
  );
};
