import { Button, Stack } from '@mui/material';
import { usePermalink } from '@src/hooks';
import { Page, TopBar } from '@src/layouts';
import { useActions, useAppState } from '@src/overmind';
import { isErrorMessage } from '@src/types';
import React, { useEffect } from 'react';
import { Footer } from './Footer';
import { AboutSection } from './about';
import { Main } from './main';
import { useTranslation } from 'react-i18next';

export const HomePage = () => {
  const { userState } = useAppState().auth;

  const { openStorageDialog } = useActions().storage;
  const { setPage } = useActions().ui;

  const { t } = useTranslation('LWC');

  const { getResourceFromPermalink } = usePermalink();

  useEffect(() => {
    setPage('home');
  }, []);

  useEffect(() => {
    loadDocumentFromPermalink();
  }, [userState]);

  const loadDocumentFromPermalink = async () => {
    const resource = await getResourceFromPermalink();
    if (!resource) return;
    if ('category' in resource) return;
    if (isErrorMessage(resource)) return;

    if (!resource.filename) openStorageDialog({ source: 'cloud', type: 'load', resource });
  };

  return (
    <Page>
      <TopBar />
      <Stack>
        <Main />
        <AboutSection />
        <Footer />
      </Stack>
    </Page>
  );
};
