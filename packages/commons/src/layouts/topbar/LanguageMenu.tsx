import LanguageIcon from '@mui/icons-material/Language';
import { Box, Button, Menu, MenuItem } from '@mui/material';
import { useCookieConsent } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { supportedLanguages } from '@src/utilities';
import { motion, type Variants } from 'framer-motion';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageMenu = () => {
  const { language } = useAppState().ui;
  const { switchLanguage } = useActions().ui;
  const { t } = useTranslation('LWC');

  const { switchLanguage: switchLanguageConsent } = useCookieConsent();

  const optionVariants: Variants = {
    initial: { y: -100 },
    visible: { y: 0 },
    exit: { y: -100 },
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (code: string) => {
    if (!code) code = language.code;
    switchLanguage(code);
    switchLanguageConsent(code);
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
        {language.shortName}
      </Button>
      <Menu anchorEl={anchorEl} id="language-menu" onClose={handleClose} open={open}>
        {Array.from(supportedLanguages).map(([, { code, name }]) => (
          <MenuItem key={code} onClick={() => handleClick(code)} value={code}>
            {t(name)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};
