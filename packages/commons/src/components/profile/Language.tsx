import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import { IconButton, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { useAnalytics, useCookieConsent } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { supportedLanguages } from '@src/utilities';
import chroma from 'chroma-js';
import React, { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { type SubMenu } from './';

export const Language = ({ onBack, onClose }: SubMenu) => {
  const { language } = useAppState().ui;
  const { switchLanguage } = useActions().ui;

  const { t, i18n } = useTranslation('commons');
  const { analytics } = useAnalytics();

  const { switchLanguage: switchLanguageConsent } = useCookieConsent();

  const changeLanguage = (event: MouseEvent<HTMLElement>, code: string) => {
    event.stopPropagation();
    if (!code) code = language.code;
    switchLanguage(code);
    switchLanguageConsent(code);
    i18n.changeLanguage(code);

    if (analytics) analytics.track('language', { language: code });
    onClose();
  };

  return (
    <List dense disablePadding sx={{ width: 300 }}>
      <ListItem sx={{ px: 1.75 }}>
        <IconButton onClick={() => onBack()} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <ListItemText primary={t('commons:language')} sx={{ textTransform: 'capitalize' }} />
      </ListItem>
      {Array.from(supportedLanguages).map(([, { code, name }]) => (
        <ListItem key={code} color="primary" sx={{ px: 0.5 }}>
          <ListItemButton
            onClick={(event) => changeLanguage(event, code)}
            selected={code === language.code}
            sx={{
              borderRadius: 1,
              '&.Mui-selected': {
                bgcolor: ({ palette }) =>
                  code === language.code
                    ? chroma(palette.primary.main).alpha(0.15).css()
                    : 'inherit',
              },
            }}
          >
            <ListItemText primary={name} sx={{ textTransform: 'capitalize' }} />
            {code === language.code && <CheckIcon color="primary" fontSize="small" />}
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};
