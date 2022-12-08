import {
  Icon,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { getIcon } from '@src/assets/icons';
import { useCookieConsent } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { useLeafWriter } from '@src/views/edit/useLeafWriter';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type ViewType } from './';
import { Footer } from './Footer';
import type { OptionProps } from './types';

interface MainProps {
  onChangeView: (view?: ViewType) => void;
  onClose: () => void;
}

export const Main = ({ onChangeView, onClose }: MainProps) => {
  const { user } = useAppState().auth;
  const { isDirty } = useAppState().editor;
  const { language, page, themeAppearance } = useAppState().ui;

  const { signOut } = useActions().auth;
  const { openDialog } = useActions().ui;

  const { t } = useTranslation('commons');
  const { leafWriter } = useLeafWriter();
  const { clearCookieConsent, showSettings } = useCookieConsent();

  const handleSignOut = async () => {
    if (!isDirty) return doSignOut();

    openDialog({
      props: {
        severity: 'warning',
        title: `${t('commons:unsaved_changes')}`,
        Message: () => <Typography>{t('storage:you_will_lose_any_unsaved_changes')}.</Typography>,
        actions: [
          { action: 'cancel', label: `${t('commons:cancel')}` },
          { action: 'signout', label: `${t('commons:sign_out')}`, variant: 'outlined' },
        ],
        //@ts-ignore
        onClose: async (action: string) => {
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
          {t('identity')}:{' '}
          <span style={{ textTransform: 'capitalize' }}>{user?.preferredID ?? t('none')}</span>
        </>
      ),
      icon: 'fingerPrint',
      secondaryIcon: 'ChevronRight',
      action: () => onChangeView('identity'),
      hide: page === 'edit',
    },
    {
      id: 'storage',
      label: (
        <>
          {t('storage')}:{' '}
          <span style={{ textTransform: 'capitalize' }}>
            {user?.prefStorageProvider ?? t('none')}
          </span>
        </>
      ),

      icon: user?.prefStorageProvider ? 'cloud' : 'cloudOffOutlined',
      secondaryIcon: 'ChevronRight',
      action: () => onChangeView('storage'),
    },
    {
      id: 'privacy',
      label: t('privacy'),
      icon: 'PrivacyTip',
      action: () => showSettings(),
    },
    {
      id: 'logout',
      label: t('sign_out'),
      icon: 'logout',
      action: () => handleSignOut(),
    },
  ];

  const uiMenu: OptionProps[] = [
    {
      id: 'appearance',
      label: (
        <>
          {t('ui:appearance')}:{' '}
          <span style={{ textTransform: 'capitalize' }}>
            {themeAppearance === 'auto'
              ? t('ui:device_theme')
              : themeAppearance === 'dark'
              ? t('ui:dark_theme')
              : t('ui:light_theme')}
          </span>
        </>
      ),
      icon:
        themeAppearance === 'auto'
          ? 'brightness4'
          : themeAppearance === 'dark'
          ? 'darkModeIcon'
          : 'brightness7',
      secondaryIcon: 'ChevronRight',
      action: () => onChangeView('appearance'),
    },
    {
      id: 'language',
      label: (
        <>
          {t('language')}: <span style={{ textTransform: 'capitalize' }}>{language.name}</span>
        </>
      ),
      icon: 'translate',
      secondaryIcon: 'ChevronRight',
      action: () => onChangeView('language'),
    },
  ];

  const editorMenu: OptionProps[] = [
    {
      id: 'settings',
      label: t('settings'),
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
                    sx={{ ':first-letter': { textTransform: 'uppercase' } }}
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
