import { Stack } from '@mui/material';
import { usePermalink } from '@src/hooks';
import { Page, TopBar } from '@src/layouts/components';
import { useActions, useAppState } from '@src/overmind';
import React, { useEffect, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import AboutSection from './about';
import Header from './Header';
import SignInSection from './SignInSection';
import { StatusBar } from './StatusBar';
import StoragePanel from './storagePanel';

const HomeView: FC = () => {
  const { userState } = useAppState().auth;
  const { openStorageDialog } = useActions().storage;

  const { t } = useTranslation();
  const { getResourceFromPermalink } = usePermalink();

  useEffect(() => {
    const resource = getResourceFromPermalink();
    if (!resource) return;
    if (!resource.filename) {
      openStorageDialog({
        source: 'cloud',
        type: 'load',
        resource,
      });
    }
  }, [userState]);

  return (
    <Page title={t('home:homepage')}>
      <TopBar />
      <Stack>
        <Stack>
          <Header />
          <SignInSection />
          <StoragePanel />
          <StatusBar />
        </Stack>
        <AboutSection />
      </Stack>
    </Page>
  );
};

export default HomeView;
