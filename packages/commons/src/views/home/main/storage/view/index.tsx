import { Stack } from '@mui/material';
import { TemplatesView } from '@src/components';
import { useAppState } from '@src/overmind';
import { useAnimation } from 'framer-motion';
import React, { useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { IView } from '..';
import { Container } from './Container';
import { RecentView } from './recent';
import { SamplesView } from './samples';

interface ViewProps {
  view?: IView;
}

const MIN_WIDTH = 275;
const MAX_WIDTH = 504;

const MAX_HEIGHT = 333;

export const View: FC<ViewProps> = ({ view }) => {
  const { userState } = useAppState().auth;
  const { language } = useAppState().ui;

  const { t } = useTranslation('commons');
  const animationControl = useAnimation();

  const [type, setType] = useState<IView>();

  useEffect(() => {
    switchView();
  }, [view]);

  useEffect(() => {
    switchView();
  }, [language]);

  const switchView = async () => {
    if (!view) return;

    await animationControl.start('hide');

    const { title, value } = view;

    const transTitle = value ? t(value) : title;
    setType({ title: transTitle, value });

    await animationControl.start('show');
  };

  return (
    <Stack>
      <Container
        animationControl={animationControl}
        height={MAX_HEIGHT}
        title={type?.title}
        width={userState === 'UNAUTHENTICATED' ? MIN_WIDTH : MAX_WIDTH}
      >
        {!type ? null : type.value === 'recent' ? (
          <RecentView />
        ) : type.value === 'samples' ? (
          <SamplesView />
        ) : (
          <TemplatesView />
        )}
      </Container>
    </Stack>
  );
};
