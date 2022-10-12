import { Stack } from '@mui/material';
import { usePermalink } from '@src/hooks';
import { Page, TopBar } from '@src/layouts';
import { useActions, useAppState } from '@src/overmind';
import React, { useEffect, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AboutSection } from './about';
import { Header } from './Header';
import { SignInSection } from './SignInSection';
import { StatusBar } from './StatusBar';
import { StoragePanel } from './storagePanel';
import { Footer } from './Footer';

export const HomeView: FC = () => {
  const { userState } = useAppState().auth;

  const { openStorageDialog } = useActions().storage;
  const { setPage } = useActions().ui;

  const { t } = useTranslation('commons');
  const { getResourceFromPermalink } = usePermalink();

  useEffect(() => {
    setPage('home');
  }, []);

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
    <Page title={t('homepage')}>
      <TopBar />
      <Stack>
        <Stack>
          <Header />
          <SignInSection />
          <StoragePanel />
          <StatusBar />
        </Stack>
        <AboutSection />
        <Footer />
      </Stack>
    </Page>
  );
};
