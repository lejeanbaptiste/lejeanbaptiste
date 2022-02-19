import { Stack } from '@mui/material';
import Page from '@src/components/Page';
import TopBar from '@src/components/topbar';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import AboutSection from './about/AboutSection';
import StoragePanel from './storagePanel';
import Header from './Header';
import SignInSection from './SignInSection';

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
