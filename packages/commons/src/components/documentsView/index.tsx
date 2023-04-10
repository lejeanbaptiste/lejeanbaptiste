import { Stack } from '@mui/material';
import { useAppState } from '@src/overmind';
import type { ViewProps } from '@src/types';
import { motion, useAnimation } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowSize } from 'react-use';
import { Container } from './components/Container';
import { TopBar } from './components/TopBar';

export { TopBar } from './components/TopBar';
export { RecentView } from './RecentView';
export { SamplesView } from './SamplesView';
export { TemplatesView } from './TemplatesView';

export type Layout = 'list' | 'grid';

interface DocumentViewProps {
  view?: ViewProps;
}

const MIN_WIDTH = 290; // Use to show the login panel // 1 column grid
const MIN_HEIGHT = 333;

export const DocumentView = ({ view }: DocumentViewProps) => {
  const { userState } = useAppState().auth;
  const { language } = useAppState().ui;

  const { t } = useTranslation('LWC');
  const animationControl = useAnimation();
  const { width: _windowWidth } = useWindowSize();

  const [width, setWidth] = useState(MIN_WIDTH);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [layout, setLayout] = useState<Layout>('list');
  const [type, setType] = useState<ViewProps>();

  useEffect(() => {
    changeViewSize();
  }, []);

  useEffect(() => {
    changeViewSize();
  }, [userState, _windowWidth]);

  useEffect(() => {
    switchView();
  }, [view?.value, language]);

  const changeViewSize = () => {
    setWidth(userState === 'AUTHENTICATED' ? getMaxWidth() : MIN_WIDTH);
    setHeight(userState === 'AUTHENTICATED' ? getMaxHeight() : MIN_HEIGHT);
  };

  const getMaxHeight = () => {
    //*  Screen width < 800px: 333px
    //*  Screen width < 1536px: 444px
    //*  Screen width > 1536px: 455px

    return _windowWidth < 1100 ? 333 : _windowWidth < 1536 ? 444 : 555;
  };

  const getMaxWidth = () => {
    //*  Screen width < 800px: 1 column grid
    //*  Screen width < 1100px: 2 column grid
    //*  Screen width < 1536px: 3 column grid
    //*  Screen width > 1536px: 4 column grid

    return _windowWidth < 800 ? 290 : _windowWidth < 1100 ? 545 : _windowWidth < 1536 ? 810 : 1072;
  };

  const switchView = async () => {
    if (!view) return;

    await animationControl.start('hide');

    const { title, value } = view;

    const transTitle = value ? t(value) : title;
    setType({ title: transTitle, value });

    await animationControl.start('show');
  };

  const changeLayout = (value: Layout) => setLayout(value);

  return (
    <Stack
      width={width}
      pt={2}
      overflow="auto"
      component={motion.div}
      animate={{ width, height }}
      transition={{ type: 'tween', duration: userState == 'UNAUTHENTICATED' ? 2 : 0.5 }}
    >
      <TopBar
        animationControl={animationControl}
        layout={layout}
        onLayoutChange={changeLayout}
        title={type?.title}
      />
      <Container
        animationControl={animationControl}
        height={height}
        layout={layout}
        width={width}
        type={type}
      />
    </Stack>
  );
};
