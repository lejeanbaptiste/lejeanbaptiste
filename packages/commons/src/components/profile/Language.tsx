import TranslateIcon from '@mui/icons-material/Translate';
import {
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ToggleButton,
} from '@mui/material';
import { StyledToggleButtonGroup } from '@src/components';
import { useAnalytics, useCookieConsent } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { supportedLanguages } from '@src/utilities';
import React, { MouseEvent, type FC } from 'react';
import { useTranslation } from 'react-i18next';

export const Language: FC = () => {
  const { language } = useAppState().ui;
  const { switchLanguage } = useActions().ui;

  const { t, i18n } = useTranslation('commons');
  const { analytics } = useAnalytics();

  const { switchLanguage: switchLanguageConsent } = useCookieConsent();

  const changeLanguage = (event: MouseEvent<HTMLElement>, code: string) => {
    if (!code) code = language.code;
    switchLanguage(code);
    switchLanguageConsent(code);
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
        <StyledToggleButtonGroup exclusive onChange={changeLanguage} value={language.code}>
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
