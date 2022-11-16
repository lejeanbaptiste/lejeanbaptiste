import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import {
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ToggleButton,
} from '@mui/material';
import { StyledToggleButtonGroup, StyledToolTip } from '@src/components';
import { useActions, useAppState } from '@src/overmind';
import type { PaletteMode } from '@src/types';
import React, { type FC, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

type Option = {
  name: PaletteMode;
  Icon: any;
};

const options: Option[] = [
  { name: 'light', Icon: Brightness7Icon },
  { name: 'auto', Icon: Brightness4Icon },
  { name: 'dark', Icon: DarkModeIcon },
];

export const ThemeAppearance: FC = () => {
  const { themeAppearance } = useAppState().ui;
  const { setThemeAppearance } = useActions().ui;

  const { t } = useTranslation('ui');

  const changePaletteMode = (event: MouseEvent<HTMLElement>, value: PaletteMode | null) => {
    if (!value || value === themeAppearance) return;
    setThemeAppearance(value);
  };

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 40 }}>
        <SettingsBrightnessIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        id="appearance"
        primary={t('appearance')}
        sx={{ textTransform: 'capitalize' }}
      />
      <ListItemSecondaryAction>
        <StyledToggleButtonGroup
          aria-label="appearance"
          exclusive
          size="small"
          onChange={changePaletteMode}
          value={themeAppearance}
        >
          {options.map(({ name, Icon }) => (
            <ToggleButton key={name} aria-label={name} size="small" value={`${t(name)}`}>
              <StyledToolTip enterDelay={1000} title={t(name) ?? name}>
                <Icon fontSize="small" sx={{ height: 16, width: 16 }} />
              </StyledToolTip>
            </ToggleButton>
          ))}
        </StyledToggleButtonGroup>
      </ListItemSecondaryAction>
    </ListItem>
  );
};
