import { Button, Stack } from '@mui/material';
import { usePermalink } from '@src/hooks';
import { Page, TopBar } from '@src/layouts';
import { useActions, useAppState } from '@src/overmind';
import { isErrorMessage } from '@src/types';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Footer } from './Footer';
import { AboutSection } from './about';
import { Main } from './main';

export const HomePage = () => {
  const { userState } = useAppState().auth;

  const { openStorageDialog } = useActions().storage;
  const { setPage } = useActions().ui;

  const location = useLocation();
  const navigate = useNavigate();

  const { t } = useTranslation();

  const { getResourceFromPermalink } = usePermalink();

  useEffect(() => {
    setPage('home');

    if (location.hash !== '') {
      scrollToElement(location.hash.slice(1), { delay: 500 });
    }
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

  const handleClickTopBar = (id: string) => {
    navigate(`#${id}`);
    scrollToElement(id);
  };

  const scrollToElement = (id: string, { delay }: { delay?: number } = {}) => {
    const element = document.getElementById(id);
    if (!element) return;

    if (!delay) {
      element.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else {
      setTimeout(() => {
        if (element) element.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, delay);
    }
  };

  return (
    <Page>
      <TopBar
        Left={
          <Button onPointerDown={() => handleClickTopBar('about')}>{t('LWC.commons.about')}</Button>
        }
      />
      <Stack>
        <Main />
        <AboutSection />
        <Footer />
      </Stack>
    </Page>
  );
};
