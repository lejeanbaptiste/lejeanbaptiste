import { Divider, Stack, Typography, useTheme } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { ViewProps } from '@src/types';
import { AnimatePresence } from 'framer-motion';
import React, { useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuButton, type MenuButtonProps } from './MenuButton';
import { PasteOption } from './PasteOption';

interface MainMenuProps {
  onSelect: (value: ViewProps) => void;
  selectedMenu?: string | undefined;
}

export const Menu: FC<MainMenuProps> = ({ onSelect, selectedMenu }) => {
  const { userState } = useAppState().auth;
  const { storageProviders } = useAppState().providers;
  const { recentDocuments } = useAppState().storage;

  const { openStorageDialog } = useActions().storage;

  const { t } = useTranslation('storage');
  const { palette } = useTheme();

  const isLoading = !selectedMenu;

  const lnkedStorageProviders = useMemo(
    () => storageProviders.some((provider) => provider.service?.isStorageProvider),
    [storageProviders]
  );

  const cloudDisabledMessage = useMemo(() => {
    if (userState !== 'AUTHENTICATED')
      return `${t('messages:you_must_sign_in_to_use_this_feature')}`;
    if (!lnkedStorageProviders) {
      return (
        <>
          <Typography paragraph variant="caption">
            {t('messages:must_link_your_account_to_a_storage_provider')}.
          </Typography>
          <Typography paragraph variant="caption">
            {t('messages:you_can_do_that_through_the_profile_menu')}.
          </Typography>
          <Typography variant="caption">
            {t('messages:suported_storage_providers')}:{' '}
            {storageProviders.map(({ providerId }, index) => (
              <span key={providerId}>
                <Typography fontWeight={700} variant="caption" sx={{ textTransform: 'capitalize' }}>
                  {providerId}
                </Typography>
                {storageProviders.length > 0 &&
                  (index === storageProviders.length - 1
                    ? ''
                    : index === storageProviders.length - 2
                    ? ` ${t('commons:and')} `
                    : ' , ')}
              </span>
            ))}
            .
          </Typography>
        </>
      );
    }
  }, [userState, lnkedStorageProviders]);

  const menuOptions: (MenuButtonProps | 'separator')[] = [
    {
      disabled: isLoading || userState !== 'AUTHENTICATED' || !lnkedStorageProviders,
      disabledTooltipText: cloudDisabledMessage,
      icon: 'cloud',
      label: t('storage:from_the_cloud'),
      value: 'cloud',
    },
    {
      disabled: isLoading,
      icon: 'computer',
      label: t('storage:from_your_device'),
      value: 'device',
    },
    'separator',
    {
      disabled: isLoading,
      hide: !recentDocuments || recentDocuments.length === 0,
      icon: 'recent',
      label: t('commons:recent'),
      value: 'recent',
    },
    { disabled: isLoading, icon: 'template', label: t('commons:templates'), value: 'templates' },
    { disabled: isLoading, icon: 'sample', label: t('commons:samples'), value: 'samples' },
  ];

  const handleClick = (value: string, title?: string) => {
    if (value === 'cloud') return openStorageDialog({ source: 'cloud', type: 'load' });
    if (value === 'device') return openStorageDialog({ source: 'local', type: 'load' });
    onSelect({ title, value });
  };

  return (
    <Stack
      width={230}
      pr={2}
      py={2}
      sx={{
        backgroundColor: palette.mode === 'dark' ? palette.grey[900] : palette.grey[50],
        borderTopLeftRadius: 1,
        borderBottomLeftRadius: 1,
      }}
    >
      <Typography
        pl={6}
        fontWeight={700}
        letterSpacing=".15rem"
        textTransform="uppercase"
        variant="subtitle1"
      >
        {t('commons:open')}
      </Typography>
      <AnimatePresence mode="popLayout">
        <Stack gap={1} pt={1}>
          {menuOptions.map((option, index) =>
            option === 'separator' ? (
              <Divider key={index} sx={{ ml: 2 }} />
            ) : option.hide ? (
              ''
            ) : (
              <MenuButton
                key={option.value}
                active={selectedMenu === option.label}
                onClick={handleClick}
                {...option}
              />
            )
          )}
          <Divider sx={{ ml: 2 }} />
          <PasteOption disabled={isLoading} />
        </Stack>
      </AnimatePresence>
    </Stack>
  );
};
