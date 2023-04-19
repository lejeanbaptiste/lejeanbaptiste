import {
  Icon,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { useCookieConsent, useLeafWriter } from '@src/hooks';
import { getIcon } from '@src/icons';
import { useActions, useAppState } from '@src/overmind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OptionProps, ViewType } from '../types';
import { Footer } from './Footer';

interface MainProps {
  onChangeView: (view?: ViewType) => void;
  onClose: () => void;
}

export const Main = ({ onChangeView, onClose }: MainProps) => {
  const { user } = useAppState().auth;
  const { contentHasChanged: isDirty } = useAppState().editor;
  const { language, page, themeAppearance } = useAppState().ui;

  const { signOut } = useActions().auth;
  const { openDialog } = useActions().ui;

  const { t } = useTranslation('LWC');
  const { leafWriter } = useLeafWriter();
  const { clearCookieConsent, showSettings } = useCookieConsent();

  const handleSignOut = async () => {
    if (!isDirty) return doSignOut();

    openDialog({
      props: {
        severity: 'warning',
        title: `${t('commons.unsaved_changes')}`,
        Body: () => <Typography>{t('storage.you_will_lose_any_unsaved_changes')}.</Typography>,
        actions: [
          { action: 'cancel', label: `${t('commons.cancel')}` },
          { action: 'signout', label: `${t('commons.sign_out')}`, variant: 'outlined' },
        ],
        onClose: async (action) => {
          if (action === 'cancel') return onClose();
          doSignOut();
        },
      },
    });
  };

  const doSignOut = async () => {
    clearCookieConsent();
    await signOut();
    onClose();
  };

  const userMenu: OptionProps[] = [
    {
      id: 'identity',
      label: (
        <>
          {t('commons.identity')}:{' '}
          <span style={{ textTransform: 'capitalize' }}>
            {user?.preferredID ?? t('commons.none')}
          </span>
        </>
      ),
      icon: 'fingerPrint',
      secondaryIcon: 'chevronRight',
      action: () => onChangeView('identity'),
      hide: page === 'edit',
    },
    {
      id: 'storage',
      label: (
        <>
          {t('commons.storage')}:{' '}
          <span style={{ textTransform: 'capitalize' }}>
            {user?.prefStorageProvider ?? t('commons.none')}
          </span>
        </>
      ),

      icon: user?.prefStorageProvider ? 'cloud' : 'cloudOffOutlined',
      secondaryIcon: 'chevronRight',
      action: () => onChangeView('storage'),
    },
    {
      id: 'privacy',
      label: t('commons.privacy_settings'),
      icon: 'privacyTip',
      action: () => showSettings(),
    },
    {
      id: 'logout',
      label: t('commons.sign_out'),
      icon: 'logout',
      action: () => handleSignOut(),
    },
  ];

  const uiMenu: OptionProps[] = [
    {
      id: 'appearance',
      label: (
        <>
          {t('ui.appearance')}:{' '}
          <span style={{ textTransform: 'capitalize' }}>
            {themeAppearance === 'auto'
              ? t('ui.device_theme')
              : themeAppearance === 'dark'
              ? t('ui.dark_theme')
              : t('ui.light_theme')}
          </span>
        </>
      ),
      icon:
        themeAppearance === 'auto'
          ? 'brightness4'
          : themeAppearance === 'dark'
          ? 'darkModeIcon'
          : 'brightness7',
      secondaryIcon: 'chevronRight',
      action: () => onChangeView('appearance'),
    },
    {
      id: 'language',
      label: (
        <>
          {t('commons.language')}:{' '}
          <span style={{ textTransform: 'capitalize' }}>{language.name}</span>
        </>
      ),
      icon: 'translate',
      secondaryIcon: 'chevronRight',
      action: () => onChangeView('language'),
    },
  ];

  const editorMenu: OptionProps[] = [
    {
      id: 'settings',
      label: t('commons.settings'),
      icon: 'settings',
      hide: page !== 'edit',
      action: (event) => {
        event?.stopPropagation();
        leafWriter?.showSettingsDialog();
        onClose();
      },
    },
  ];

  const menus: OptionProps[][] = [userMenu, uiMenu, editorMenu];

  return (
    <>
      <List dense disablePadding sx={{ width: 300 }}>
        {menus.map((menu) => {
          if (menu.filter((item) => !item.hide).length === 0) return null;
          return menu
            .filter((item) => !item.hide)
            .map(({ action, id, label, icon, secondaryIcon }, index, array) => (
              <ListItem key={id} divider={index === array.length - 1} sx={{ px: 0.5 }}>
                <ListItemButton onClick={action} sx={{ borderRadius: 1 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {icon && <Icon component={getIcon(icon)} fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={label}
                    sx={{ '::first-letter': { textTransform: 'uppercase' } }}
                  />
                  {secondaryIcon && <Icon component={getIcon(secondaryIcon)} fontSize="small" />}
                </ListItemButton>
              </ListItem>
            ));
        })}
      </List>

      <Footer onClick={onClose} />
    </>
  );
};
