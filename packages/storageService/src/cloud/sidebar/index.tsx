import { Stack, useMediaQuery, useTheme } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useAppState } from '../../overmind';
import MainMenu from './MainMenu';
import MobileMenu from './MobileMenu';
import PublicRepositories from './publicRepository';

const Sidebar = () => {
  const { cloud } = useAppState();
  const { owner, user } = cloud;

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  const [selectedMenu, setSelectedMenu] = useState('owner');

  useEffect(() => {
    owner && user?.username !== owner?.username
      ? setSelectedMenu(owner?.username)
      : setSelectedMenu('owner');
  }, [cloud.name]);

  return (
    <Stack
      data-testid="sidebar"
      width={isSM ? '100%' : 300}
      pt={isSM ? 1 : 2}
      spacing={isSM ? 0 : 3}
    >
      {isSM ? (
        <MobileMenu onSelect={setSelectedMenu} selectedMenu={selectedMenu} />
      ) : (
        <>
          <MainMenu onSelect={setSelectedMenu} selectedMenu={selectedMenu} />
          <PublicRepositories onSelect={setSelectedMenu} selectedMenu={selectedMenu} />
        </>
      )}
    </Stack>
  );
};

export default Sidebar;
