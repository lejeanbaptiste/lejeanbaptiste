import { Paper, Stack, useTheme } from '@mui/material';
import { DocumentView } from '@src/components';
import { db } from '@src/db';
import { useAppState } from '@src/overmind';
import type { ViewProps } from '@src/types';
import { useLiveQuery } from 'dexie-react-hooks';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { Menu } from './menu';

type ViewType = 'recent' | 'samples' | 'template';

export const Storage = () => {
  const { userState } = useAppState().auth;

  const { t } = useTranslation('LWC');
  const { palette } = useTheme();

  const countRecentDocs = useLiveQuery(() => db.recentDocuments.count(), [], 0);

  const [selectedView, setSelectedView] = useState<ViewProps | undefined>(undefined);

  const view: Record<ViewType, ViewProps> = {
    recent: { title: `${t('commons.recent')}`, value: 'recent' },
    samples: { title: `${t('commons.samples')}`, value: 'samples' },
    template: { title: `${t('commons.templates')}`, value: 'templates' },
  };

  useEffect(() => {
    if (userState !== 'AUTHENTICATING') setView();
  }, [userState, countRecentDocs]);

  const setView = async () => {
    if (userState === 'UNAUTHENTICATED') {
      setSelectedView(view.samples);
      return;
    }

    if (userState === 'AUTHENTICATED') {
      countRecentDocs === 0 ? setSelectedView(view.template) : setSelectedView(view.recent);
      return;
    }
  };

  const handleSelect = (view: ViewProps) => {
    if (selectedView?.value === view.value) return;
    setSelectedView(view);
  };

  return (
    <Stack direction="row" justifyContent="center">
      {userState === 'UNAUTHENTICATED' && <Sidebar />}
      <Paper elevation={palette.mode === 'dark' ? 6 : 1} sx={{ zIndex: 2 }}>
        <Stack direction="row" justifyContent="center">
          <Menu onSelect={handleSelect} selectedMenu={selectedView?.value} />
          <DocumentView view={selectedView} />
        </Stack>
      </Paper>
    </Stack>
  );
};
