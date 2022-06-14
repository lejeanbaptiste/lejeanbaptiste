import { Stack } from '@mui/material';
import Page from '@src/components/Page';
import TopBar from '@src/components/topbar';
import { usePermalink } from '@src/hooks/usePermalink';
import { useActions, useAppState } from '@src/overmind';
import React, { useEffect, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import AboutSection from './about';
import Header from './Header';
import SignInSection from './SignInSection';
import StoragePanel from './storagePanel';

const HomeView: FC = () => {
  const { t } = useTranslation();

  return (
    <Page title={t('home:homepage')}>
      <TopBar />
      <Stack>
        <Header />
        <SignInSection />
        <StoragePanel />
        <AboutSection />
      </Stack>
    </Page>
  );
};

export default HomeView;
