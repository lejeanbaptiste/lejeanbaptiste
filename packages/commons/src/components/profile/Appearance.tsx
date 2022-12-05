import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import {
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { getIcon } from '@src/assets/icons';
import { useActions, useAppState } from '@src/overmind';
import type { PaletteMode } from '@src/types';
import chroma from 'chroma-js';
import React, { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { type SubMenu } from '.';
import type { OptionProps } from './types';

export const Appearance = ({ onBack, onClose }: SubMenu) => {
  const { themeAppearance } = useAppState().ui;
  const { setThemeAppearance } = useActions().ui;

  const { t } = useTranslation('ui');

  const handleSelect = (event: MouseEvent, value: string) => {
    event.stopPropagation();
    if (value !== themeAppearance) setThemeAppearance(value as PaletteMode);
    onClose();
  };

  const options: OptionProps[] = [
    { id: 'auto', label: t('device_theme'), icon: 'brightness4' },
    { id: 'dark', label: t('dark_theme'), icon: 'darkModeIcon' },
    { id: 'light', label: t('light_theme'), icon: 'brightness7' },
  ];

  return (
    <List dense disablePadding sx={{ width: 300 }}>
      <ListItem sx={{ px: 1.75 }}>
        <IconButton onClick={() => onBack()} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <ListItemText primary={t('commons:identity')} sx={{ textTransform: 'capitalize' }} />
      </ListItem>
      {options.map(({ id, icon, label }) => (
        <ListItem key={id} color="primary" sx={{ px: 0.5 }}>
          <ListItemButton
            onClick={(event) => handleSelect(event, id)}
            selected={id === themeAppearance}
            sx={{
              borderRadius: 1,
              '&.Mui-selected': {
                bgcolor: ({ palette }) =>
                  id === themeAppearance
                    ? chroma(palette.primary.main).alpha(0.15).css()
                    : 'inherit',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              {icon && (
                <Icon
                  color={id === themeAppearance ? 'primary' : 'inherit'}
                  component={getIcon(icon)}
                  fontSize="small"
                />
              )}
            </ListItemIcon>
            <ListItemText primary={label} sx={{ textTransform: 'capitalize' }} />
            {id === themeAppearance && <CheckIcon color="primary" fontSize="small" />}
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};
