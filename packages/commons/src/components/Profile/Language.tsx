import TranslateIcon from '@mui/icons-material/Translate';
import {
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { analytics } from '@src/analytics';
import { useActions, useAppState } from '@src/overmind';
import { supportedLanguages } from '@src/utilities/util';
import React, { FC, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButtonGroup-grouped': {
    margin: theme.spacing(0.5),
    border: 0,
    '&.Mui-disabled': {
      border: 0,
    },
    '&:not(:first-of-type)': {
      borderRadius: theme.shape.borderRadius,
    },
    '&:first-of-type': {
      borderRadius: theme.shape.borderRadius,
    },
  },
}));

const Language: FC = () => {
  const { language } = useAppState().ui;
  const { switchLanguage } = useActions().ui;

  const { t, i18n } = useTranslation();

  const changeLanguage = (event: MouseEvent<HTMLElement>, code: string) => {
    if (!code) code = language.code;
    switchLanguage(code);
    i18n.changeLanguage(code);

    analytics.track('language', { language: code });
  };

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 40 }}>
        <TranslateIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText id="language" primary={t('home:language')} />
      <ListItemSecondaryAction>
        <StyledToggleButtonGroup
          aria-label="language"
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

export default Language;
