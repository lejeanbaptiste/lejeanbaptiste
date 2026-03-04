import { Box, Button, Stack } from '@mui/material';
import { usePermalink } from '@src/hooks';
import { Page, TopBar } from '@src/layouts';
import { useActions, useAppState } from '@src/overmind';
import { isErrorMessage } from '@src/types';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
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
        <Box
          // id="about"
          // py={10}
          // px={2}
          sx={[
            {
              // backgroundColor: (theme) => `rgba(${theme.vars.palette.primary.mainChannel} / 0.02)`,
              backgroundImage:
                'linear-gradient(to bottom, #ffffff, #f7f8f9, #edf1f4, #e3eaed, #d9e4e4)',
              scrollMarginBlockStart: 300,
            },
            (theme) =>
              theme.applyStyles('dark', {
                // backgroundColor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.02)`,
                backgroundImage:
                  'linear-gradient(to bottom, #121212, #111213, #101214, #0d1215, #091315)',
              }),
          ]}
        >
          <AboutSection />
          <Footer />
        </Box>
      </Stack>
    </Page>
  );
};
