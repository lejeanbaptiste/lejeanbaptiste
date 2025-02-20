import { Box, Divider, Popover, Stack } from '@mui/material';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Appearance, Identity, Language, Main, Storage, UserCard } from './components';
import { ViewType } from './types';

interface ProfileProps {
  anchor: HTMLDivElement;
  onClose: () => void;
}

const WIDTH = 300;

export const Profile = ({ anchor, onClose }: ProfileProps) => {
  const [stackViews, setStackedViews] = useState<ViewType[]>(['main']);

  const open = Boolean(anchor);

  const handleClose = (event: MouseEvent, reason?: string) => {
    event.stopPropagation();
    onClose();
  };

  const handleChangeView = async (view?: ViewType) => {
    const stack = view ? [...stackViews, view] : stackViews.slice(0, -1);
    setStackedViews(stack);
  };

  const viewComponent: Record<ViewType, React.ReactNode> = {
    main: <Main onClose={onClose} onChangeView={handleChangeView} />,
    appearance: <Appearance onBack={handleChangeView} onClose={onClose} />,
    language: <Language onBack={handleChangeView} onClose={onClose} />,
    identity: <Identity onBack={handleChangeView} onClose={onClose} />,
    storage: <Storage onBack={handleChangeView} onClose={onClose} />,
  };

  return (
    <Popover
      anchorEl={anchor}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      id="profile"
      onClose={handleClose}
      open={open}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <UserCard />
      <Divider />
      <AnimatePresence mode="wait">
        <Box overflow="hidden" width={WIDTH}>
          <Stack direction="row">
            {stackViews.map((view) => (
              <Box
                key={view}
                component={motion.div}
                animate={{
                  width: view !== stackViews[stackViews.length - 1] ? 0 : WIDTH,
                  height: view !== stackViews[stackViews.length - 1] ? 1 : '100%',
                }}
                overflow="hidden"
                width={WIDTH}
              >
                {viewComponent[view]}
              </Box>
            ))}
          </Stack>
        </Box>
      </AnimatePresence>
    </Popover>
  );
};
