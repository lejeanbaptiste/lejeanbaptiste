import LanguageIcon from '@mui/icons-material/Language';
import { Box, Button, Menu, MenuItem } from '@mui/material';
import { useCookieConsent } from '@src/hooks';
import { locales } from '@src/i18n';
import { useActions, useAppState } from '@src/overmind';
import { motion, type Variants } from 'framer-motion';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageMenu = () => {
  const { currentLocale } = useAppState().ui;
  const { switchLanguage } = useActions().ui;
  const { t } = useTranslation();

  const { switchLanguage: switchLanguageConsent } = useCookieConsent();

  const optionVariants: Variants = {
    initial: { y: -100 },
    visible: { y: 0 },
    exit: { y: -100 },
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleSelectLocale = (locale: string) => {
    switchLanguage(locale);
    switchLanguageConsent(locale);
    handleClose();
  };

  const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  return (
    <Box
      key="language"
      component={motion.div}
      variants={optionVariants}
      initial="initial"
      animate="visible"
      transition={{ delay: 0.2 }}
      exit="exit"
    >
      <Button
        color="inherit"
        onClick={handleOpenMenu}
        size="small"
        startIcon={<LanguageIcon fontSize="inherit" />}
      >
        {currentLocale}
      </Button>
      <Menu anchorEl={anchorEl} id="language-menu" onClose={handleClose} open={open}>
        {locales.map((locale) => (
          <MenuItem key={locale} onPointerDown={() => handleSelectLocale(locale)} value={locale}>
            {t(`LWC.languages.${locale}`, { lng: locale, fallbackLng: 'en' })}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};
