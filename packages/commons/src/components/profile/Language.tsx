import TranslateIcon from '@mui/icons-material/Translate';
import {
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ToggleButton
} from '@mui/material';
import { StyledToggleButtonGroup } from '@src/components';
import { useAnalytics } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { supportedLanguages } from '@src/utilities';
import React, { FC, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

export const Language: FC = () => {
  const { language } = useAppState().ui;
  const { switchLanguage } = useActions().ui;

  const { t, i18n } = useTranslation('commons');

  const { analytics } = useAnalytics();

  const changeLanguage = (event: MouseEvent<HTMLElement>, code: string) => {
    if (!code) code = language.code;
    switchLanguage(code);
    i18n.changeLanguage(code);

    if (analytics) analytics.track('language', { language: code });
  };

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 40 }}>
        <TranslateIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText id="language" primary={t('language')} sx={{ textTransform: 'capitalize' }} />
      <ListItemSecondaryAction>
        <StyledToggleButtonGroup
          aria-label={t('language')}
          exclusive
          onChange={changeLanguage}
          value={language.code}
        >
          {Array.from(supportedLanguages).map(([, { code, shortName }]) => (
            <ToggleButton
              key={code}
              aria-label={shortName}
              size="small"
              sx={{ height: 28 }}
              value={code}
            >
              {shortName}
            </ToggleButton>
          ))}
        </StyledToggleButtonGroup>
      </ListItemSecondaryAction>
    </ListItem>
  );
};
