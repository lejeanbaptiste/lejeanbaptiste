import { Divider, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import { IView } from '@src/types';
import { AnimatePresence } from 'framer-motion';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuButton, type MenuButtonProps } from './MenuButton';
import { PasteOption } from './PasteOption';

interface MainMenuProps {
  onSelect: (value: IView) => void;
  selectedMenu?: string | undefined;
}

export const Menu: FC<MainMenuProps> = ({ onSelect, selectedMenu }) => {
  const { userState } = useAppState().auth;
  const { recentDocuments } = useAppState().storage;

  const { openStorageDialog } = useActions().storage;

  const { t } = useTranslation('storage');
  const { palette } = useTheme();

  const isLoading = !selectedMenu;

  const menuOptions: (MenuButtonProps | 'separator')[] = [
    {
      disabled: isLoading || userState !== 'AUTHENTICATED',
      disabledTooltipText:
        userState !== 'AUTHENTICATED' ? t('messages:you_must_sign_in_to_use_this_feature') : '',
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
        zIndex: 2,
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
