import { Divider, Stack, Typography } from '@mui/material';
import { db } from '@src/db';
import { useMessage } from '@src/hooks';
import { useActions, useAppState } from '@src/overmind';
import { ViewType } from '@src/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MenuButton } from './MenuButton';
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

  const { t } = useTranslation();
  const countRecentDocs = useLiveQuery(() => db.recentDocuments.count(), [], 0);

  const { cloudDisabledMessage } = useMessage();

  const isLoading = !selectedMenu;

  return (
    <Stack
      width={240}
      px={1}
      py={2}
      sx={[
        (theme) => ({
          borderTopLeftRadius: 1,
          borderBottomLeftRadius: 1,
          backgroundColor: theme.vars.palette.grey[50],
        }),
        (theme) =>
          theme.applyStyles('dark', {
            backgroundColor: theme.vars.palette.grey[900],
          }),
      ]}
    >
      <Typography
        pl={6}
        fontWeight={700}
        letterSpacing=".15rem"
        textTransform="uppercase"
        variant="subtitle1"
      >
        {t('LWC.commons.open')}
      </Typography>
      <AnimatePresence mode="popLayout">
        <Stack gap={1} pt={1} component={motion.div} layout="preserve-aspect">
          <MenuButton
            active={selectedMenu === 'cloud'}
            disabled={
              isLoading ||
              userState !== 'AUTHENTICATED' ||
              !storageProviders.some((provider) => provider.service?.isStorageProvider)
            }
            disabledTooltipText={cloudDisabledMessage}
            icon="cloud"
            label={t('LWC.storage.from_the_cloud')}
            onClick={() => openStorageDialog({ source: 'cloud', type: 'load' })}
            value="cloud"
          />
          <MenuButton
            active={selectedMenu === 'local'}
            disabled={isLoading}
            icon="computer"
            label={t('LWC.storage.from_your_device')}
            onClick={() => openStorageDialog({ source: 'local', type: 'load' })}
            value="local"
          />
          <MenuButton
            active={selectedMenu === 'import'}
            disabled={isLoading}
            icon="importIcon"
            label={t('LWC.storage.import document')}
            onClick={() => openDialog({ type: 'import', props: { maxWidth: 'md' } })}
            value="import"
          />
          <Divider sx={{ ml: 2 }} />
          <MenuButton
            active={selectedMenu === 'recent'}
            disabled={isLoading}
            hide={userState !== 'AUTHENTICATED' || countRecentDocs === 0}
            icon="recent"
            label={t('LWC.commons.recent')}
            onClick={() => onSelect('recent')}
            value="recent"
          />
          <MenuButton
            active={selectedMenu === 'templates'}
            disabled={isLoading}
            icon="template"
            label={t('LWC.commons.templates')}
            onClick={() => onSelect('templates')}
            value="templates"
          />
          <MenuButton
            active={selectedMenu === 'samples'}
            disabled={isLoading}
            icon="sample"
            label={t('LWC.commons.samples')}
            onClick={() => onSelect('samples')}
            value="samples"
          />
          <Divider sx={{ ml: 2 }} />
          <PasteOption disabled={isLoading} />
        </Stack>
      </AnimatePresence>
    </Stack>
  );
};
