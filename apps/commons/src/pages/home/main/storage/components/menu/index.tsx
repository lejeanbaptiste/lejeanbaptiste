import { Divider, Stack, Typography, useTheme } from '@mui/material';
import { db } from '@src/db';
import { useMessage } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { ViewType } from '@src/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MenuButton, type MenuButtonProps } from './MenuButton';
import { PasteOption } from './PasteOption';

interface MainMenuProps {
  onSelect: (value: ViewType) => void;
  selectedMenu?: string | undefined;
}

export const Menu = ({ onSelect, selectedMenu }: MainMenuProps) => {
  const { userState } = useAppState().auth;
  const { storageProviders } = useAppState().providers;

  const { openStorageDialog } = useActions().storage;
  const { openDialog } = useActions().ui;

  const { t } = useTranslation('LWC');
  const { palette } = useTheme();
  const countRecentDocs = useLiveQuery(() => db.recentDocuments.count(), [], 0);

  const { cloudDisabledMessage } = useMessage();

  const isLoading = !selectedMenu;

  const menuOptions: (MenuButtonProps | 'separator')[] = [
    {
      disabled:
        isLoading ||
        userState !== 'AUTHENTICATED' ||
        !storageProviders.some((provider) => provider.service?.isStorageProvider),
      disabledTooltipText: cloudDisabledMessage,
      icon: 'cloud',
      label: t('LWC:storage.from_the_cloud'),
      onClick: () => openStorageDialog({ source: 'cloud', type: 'load' }),
      value: 'cloud',
    },
    {
      disabled: isLoading,
      icon: 'computer',
      label: t('LWC:storage.from_your_device'),
      onClick: () => openStorageDialog({ source: 'local', type: 'load' }),
      value: 'local',
    },
    {
      disabled: isLoading,
      icon: 'importIcon',
      label: t('LWC:storage.import document'),
      onClick: () => openDialog({ type: 'import', props: { maxWidth: 'md' } }),
      value: 'import',
    },
    'separator',
    {
      disabled: isLoading,
      hide: userState !== 'AUTHENTICATED' || countRecentDocs === 0,
      icon: 'recent',
      label: t('LWC:commons.recent'),
      onClick: () => onSelect('recent'),
      value: 'recent',
    },
    {
      disabled: isLoading,
      icon: 'template',
      label: t('LWC:commons.templates'),
      onClick: () => onSelect('templates'),
      value: 'templates',
    },
    {
      disabled: isLoading,
      icon: 'sample',
      label: t('LWC:commons.samples'),
      onClick: () => onSelect('samples'),
      value: 'samples',
    },
  ];

  return (
    <Stack
      width={240}
      px={1}
      py={2}
      sx={{
        bgcolor: palette.mode === 'dark' ? palette.grey[900] : palette.grey[50],
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
        {t('LWC:commons.open')}
      </Typography>
      <AnimatePresence mode="popLayout">
        <Stack gap={1} pt={1} component={motion.div} layout="preserve-aspect">
          {menuOptions.map((option, index) =>
            option === 'separator' ? (
              <Divider key={index} sx={{ ml: 2 }} />
            ) : option.hide ? (
              ''
            ) : (
              <MenuButton key={option.label} active={selectedMenu === option.value} {...option} />
            ),
          )}
          <Divider sx={{ ml: 2 }} />
          <PasteOption disabled={isLoading} />
        </Stack>
      </AnimatePresence>
    </Stack>
  );
};
