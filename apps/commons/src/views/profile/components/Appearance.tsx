import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import {
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { Icon } from '@src/icons';
import { useActions, useAppState } from '@src/overmind';
import type { PaletteMode } from '@src/types';
import { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { OptionProps, SubMenu } from '../types';

export const Appearance = ({ onBack, onClose }: SubMenu) => {
  const { setMode } = useColorScheme();

  const { themeAppearance } = useAppState().ui;
  const { setThemeAppearance } = useActions().ui;

  const { t } = useTranslation();

  const handleSelect = (event: MouseEvent, value: string) => {
    event.stopPropagation();
    setMode(value as PaletteMode);
    setThemeAppearance(value as PaletteMode);
    onClose();
  };

  const options: OptionProps[] = [
    { id: 'system', label: t('LWC.ui.device_theme'), icon: 'brightness4' },
    { id: 'dark', label: t('LWC.ui.dark_theme'), icon: 'darkModeIcon' },
    { id: 'light', label: t('LWC.ui.light_theme'), icon: 'brightness7' },
  ];

  return (
    <List dense disablePadding sx={{ width: 300 }}>
      <ListItem sx={{ px: 1.75 }}>
        <IconButton onPointerDown={() => onBack()} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <ListItemText primary={t('LWC.commons.identity')} sx={{ textTransform: 'capitalize' }} />
      </ListItem>
      {options.map(({ id, icon, label }) => (
        <ListItem key={id} color="primary" sx={{ px: 0.5 }}>
          <ListItemButton
            onPointerDown={(event) => handleSelect(event, id)}
            selected={id === themeAppearance}
            sx={[
              { borderRadius: 1 },
              id === themeAppearance
                ? (theme) => ({
                    '&.Mui-selected': {
                      backgroundColor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.15)`,
                    },
                  })
                : { '&.Mui-selected': { backgroundColor: 'inherit' } },
            ]}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              {icon && (
                <Icon
                  name={icon}
                  color={id === themeAppearance ? 'primary' : 'inherit'}
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
