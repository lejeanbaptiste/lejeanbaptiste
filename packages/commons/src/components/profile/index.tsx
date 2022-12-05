import { Box, Divider, Popover, Stack } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState, type FC } from 'react';
import { ReactNode } from 'react-markdown';
import { Appearance } from './Appearance';
import { Identity } from './Identity';
import { Language } from './Language';
import { Main } from './Main';
import { Storage } from './Storage';
import { UserCard } from './UserCard';

interface ProfileProps {
  anchor: HTMLDivElement;
  onClose: () => void;
}

export interface SubMenu {
  onBack: () => void;
  onClose: () => void;
  width?: number;
}

export type ViewType = 'main' | 'appearance' | 'language' | 'identity' | 'storage';

const WIDTH = 300;

export const Profile: FC<ProfileProps> = ({ anchor, onClose }) => {
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

  const viewComponent: Record<ViewType, ReactNode> = {
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
