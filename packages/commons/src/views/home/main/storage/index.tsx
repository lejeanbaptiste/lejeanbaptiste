import { Paper, Stack, useTheme } from '@mui/material';
import { DocumentView } from '@src/components';
import { useActions, useAppState } from '@src/overmind';
import type { IView } from '@src/types';
import React, { useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from './menu';
import { Sidebar } from './Sidebar';

export const Storage: FC = () => {
  const { userState } = useAppState().auth;
  const { recentDocuments } = useAppState().storage;

  const { loadRecentFiles } = useActions().storage;

  const { t } = useTranslation('commons');
  const { palette } = useTheme();

  const [selectedView, setSelectedView] = useState<IView | undefined>(undefined);

  useEffect(() => {
    if (userState !== 'AUTHENTICATING') setView();
  }, [userState]);

  useEffect(() => {
    if (recentDocuments?.length === 0) {
      setSelectedView({ title: t('templates'), value: 'templates' });
    }
  }, [recentDocuments]);

  const setView = async () => {
    if (userState === 'UNAUTHENTICATED') {
      setSelectedView({ title: t('samples'), value: 'samples' });
      return;
    }

    if (userState === 'AUTHENTICATED') {
      const recent = await loadRecentFiles();
      recent.length > 0
        ? setSelectedView({ title: t('recent'), value: 'recent' })
        : setSelectedView({ title: t('templates'), value: 'templates' });
      return;
    }
  };

  const handleSelect = (view: IView) => {
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
