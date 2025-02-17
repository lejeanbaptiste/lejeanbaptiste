import { Paper, Stack } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { db } from '@src/db';
import { useAppState } from '@src/overmind';
import type { ViewProps, ViewType } from '@src/types';
import { DocumentViews } from '@src/views';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Sidebar } from './components';

export const Storage = () => {
  const { userState } = useAppState().auth;
  const { mode, systemMode } = useColorScheme();
  const { t } = useTranslation();

  const countRecentDocs = useLiveQuery(() => db.recentDocuments.count(), [], 0);

  const [selectedView, setSelectedView] = useState<ViewType>('blank');

  const view: Record<ViewType, ViewProps> = {
    blank: { title: '', value: 'blank' },
    recent: { title: `${t('LWC.commons.recent')}`, value: 'recent' },
    samples: { title: `${t('LWC.commons.samples')}`, value: 'samples' },
    templates: { title: `${t('LWC.commons.templates')}`, value: 'templates' },
  };

  const isDarkMode = mode === 'dark' || (mode === 'system' && systemMode === 'dark');

  useEffect(() => {
    if (userState !== 'AUTHENTICATING') setView();
  }, [userState, countRecentDocs]);

  const setView = async () => {
    if (userState === 'UNAUTHENTICATED') {
      setSelectedView(view.samples.value);
      return;
    }

    if (userState === 'AUTHENTICATED') {
      countRecentDocs === 0
        ? setSelectedView(view.templates.value)
        : setSelectedView(view.recent.value);
      return;
    }
  };

  const handleSelect = (value: ViewType) => {
    if (selectedView === value) return;
    setSelectedView(value);
  };

  return (
    <Stack direction="row" justifyContent="center">
      {userState === 'UNAUTHENTICATED' && <Sidebar />}
      <Paper elevation={isDarkMode ? 6 : 1} sx={{ zIndex: 2 }}>
        <Stack direction="row" justifyContent="center">
          <Menu onSelect={handleSelect} selectedMenu={selectedView} />
          <DocumentViews {...view[selectedView]} />
        </Stack>
      </Paper>
    </Stack>
  );
};
