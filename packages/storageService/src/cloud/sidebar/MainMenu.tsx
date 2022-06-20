import { Stack } from '@mui/material';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CollectionSource } from '../../types';
import { useActions } from '../../overmind';
import SideButton from './SideButton';

interface MainMenuProps {
  onSelect: (value: string) => void;
  selectedMenu: string;
}

interface MenuOption {
  label?: string;
  value: CollectionSource;
}

const MainMenu: FC<MainMenuProps> = ({ onSelect, selectedMenu }) => {
  const { t } = useTranslation();
  const { setCollectionSource } = useActions().cloud;

  const menuOptions: MenuOption[] = [
    { label: t('cloud:mainMenu:my_repositories'), value: 'owner' },
    { label: t('cloud:mainMenu:shared_with_me'), value: 'collaborator' },
    { label: t('cloud:mainMenu:organizations'), value: 'organization' },
  ];

  const handleClick = (value: string) => {
    onSelect(value);
    setCollectionSource(value as CollectionSource);
  };

  return (
    <Stack>
      {menuOptions.map(({ label, value }) => (
        <SideButton
          key={value}
          active={selectedMenu === value}
          label={label ?? value}
          onClick={handleClick}
          value={value}
        />
      ))}
    </Stack>
  );
};

export default MainMenu;
