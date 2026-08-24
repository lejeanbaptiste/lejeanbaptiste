import { Stack } from '@mui/material';
import { useAppState } from '@src/overmind';
import type { ViewProps, ViewType } from '@src/types';
import { motion, useAnimation } from 'motion/react';
import { useEffect, useState } from 'react';
import { useWindowSize } from 'react-use';
import { Container, TopBar } from './components';

export type Layout = 'list' | 'grid';

export { TopBar } from './components';
export { TemplatesView } from './views';

type DocumentViewsProps = ViewProps;

const MIN_WIDTH = 290; // Use to show the login panel // 1 column grid
const MIN_HEIGHT = 333;

export const DocumentViews = ({ title, value }: DocumentViewsProps) => {
  const { userState } = useAppState().auth;
  const { currentLocale } = useAppState().ui;

  const animationControl = useAnimation();
  const { width: _windowWidth } = useWindowSize();

  const [width, setWidth] = useState(MIN_WIDTH);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [layout, setLayout] = useState<Layout>('list');
  const [type, setType] = useState<ViewType>('samples');

  // The effect below already runs on mount, so a separate mount-only copy of
  // this call was redundant.
  //
  // Keyed to what actually changes the size. `changeViewSize` is redefined
  // every render, so depending on it would resize on every render.
  useEffect(() => {
    changeViewSize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState, _windowWidth]);

  // Same reasoning, and here it matters more: `switchView` runs a hide/show
  // animation, so re-running it every render would animate continuously.
  useEffect(() => {
    switchView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocale, value]);

  const changeViewSize = () => {
    setWidth(userState === 'AUTHENTICATED' ? getMaxWidth() : MIN_WIDTH);
    setHeight(userState === 'AUTHENTICATED' ? getMaxHeight() : MIN_HEIGHT);
  };

  const getMaxHeight = () => {
    //*  Screen width < 1536px: 444px
    //*  Screen width > 1536px: 455px

    return _windowWidth < 1536 ? 444 : 555;
  };

  const getMaxWidth = () => {
    //*  Screen width < 800px: 1 column grid
    //*  Screen width < 1100px: 2 column grid
    //*  Screen width < 1536px: 3 column grid
    //*  Screen width > 1536px: 4 column grid

    return _windowWidth < 800 ? 280 : _windowWidth < 1100 ? 535 : _windowWidth < 1536 ? 810 : 1062;
  };

  const switchView = async () => {
    await animationControl.start('hide');
    setType(value);
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
        title={title}
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
