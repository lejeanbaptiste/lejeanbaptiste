import { Box, Button, Menu, MenuItem } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import { useActions, useAppState } from '@src/overmind';
import { supportedLanguages } from '@src/utilities/util';
import { motion } from 'framer-motion';
import React, { FC, MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageMenu: FC = () => {
  const { t } = useTranslation();
  const { language } = useAppState();
  const { switchLanguage } = useActions();

  const optionVariants = {
    initial: { y: -100 },
    visible: { y: 0 },
    exit: { y: -100 },
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (code: string) => {
    if (!code) code = language.code;
    switchLanguage(code);
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
        {Object.values(supportedLanguages).map(({ code, name }) => (
          <MenuItem key={code} onClick={() => handleClick(code)} value={code}>
            {t(`home:${name}`)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default LanguageMenu;
