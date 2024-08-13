import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import { IconButton, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { useAnalytics, useCookieConsent } from '@src/hooks';
import { locales } from '@src/i18n';
import { useActions, useAppState } from '@src/overmind';
import chroma from 'chroma-js';
import { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubMenu } from '../types';

export const Language = ({ onBack, onClose }: SubMenu) => {
  const { currentLocale } = useAppState().ui;
  const { switchLanguage } = useActions().ui;

  const { t, i18n } = useTranslation();
  const { analytics } = useAnalytics();

  const { switchLanguage: switchLanguageConsent } = useCookieConsent();

  const changeLanguage = (event: MouseEvent<HTMLElement>, locale: string) => {
    event.stopPropagation();

    switchLanguage(locale);
    switchLanguageConsent(locale);
    i18n.changeLanguage(locale);

    if (analytics) analytics.track('language', { language: locale });
    onClose();
  };

  return (
    <List dense disablePadding sx={{ width: 300 }}>
      <ListItem sx={{ px: 1.75 }}>
        <IconButton onPointerDown={() => onBack()} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <ListItemText primary={t('LWC.commons.language')} sx={{ textTransform: 'capitalize' }} />
      </ListItem>
      {locales.map((locale) => (
        <ListItem key={locale} color="primary" sx={{ px: 0.5 }}>
          <ListItemButton
            onPointerDown={(event) => changeLanguage(event, locale)}
            selected={locale === currentLocale}
            sx={{
              borderRadius: 1,
              '&.Mui-selected': {
                bgcolor: ({ palette }) =>
                  locale === currentLocale
                    ? chroma(palette.primary.main).alpha(0.15).css()
                    : 'inherit',
              },
            }}
          >
            <ListItemText
              primary={t(`LWC.languages.${locale}`, { lng: locale, fallbackLng: 'en' })}
            />
            {locale === currentLocale && <CheckIcon color="primary" fontSize="small" />}
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};
