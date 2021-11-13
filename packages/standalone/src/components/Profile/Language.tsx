import {
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import { useActions, useAppState } from '@src/overmind';
import { supportedLanguages } from '@src/utilities/util';
import React, { FC, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

const Language: FC = () => {
  const { t } = useTranslation();

  const { language } = useAppState();
  const { switchLanguage } = useActions();

  const changeLanguage = (event: MouseEvent<HTMLElement>, code: string) => {
    if (!code) code = language.code;
    switchLanguage(code);
  };

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 40 }}>
        <LanguageIcon />
      </ListItemIcon>
      <ListItemText id="language" primary={t('home:language')} />
      <ListItemSecondaryAction>
        <ToggleButtonGroup
          aria-label="language"
          exclusive
          onChange={changeLanguage}
          value={language.code}
        >
          {Object.values(supportedLanguages).map(({ code, shortName }) => (
            <ToggleButton key={code} sx={{ height: 28 }} value={code}>
              {shortName}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </ListItemSecondaryAction>
    </ListItem>
  );
};

export default Language;
