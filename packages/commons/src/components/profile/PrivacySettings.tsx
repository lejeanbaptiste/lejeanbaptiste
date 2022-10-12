import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useCookieConsent } from '@src/hooks';
import React, { MouseEvent, type FC } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onClick: () => void;
}

export const PrivacySettings: FC<Props> = ({ onClick }) => {
  const { t } = useTranslation('cookie_consent');
  const { showSettings } = useCookieConsent();

  const handleClick = (event: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => {
    event.stopPropagation();
    onClick();
    showSettings();
  };

  return (
    <ListItem disableGutters>
      <ListItemButton onClick={handleClick}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <PrivacyTipIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          id="settings"
          primary={t('privacy_settings')}
          sx={{ textTransform: 'capitalize' }}
        />
        <ChevronRightIcon />
      </ListItemButton>
    </ListItem>
  );
};
