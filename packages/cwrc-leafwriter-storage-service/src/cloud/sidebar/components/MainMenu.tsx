import { Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions } from '../../../overmind';
import type { CollectionSource } from '../../../types';
import { SideButton } from './SideButton';

interface MainMenuProps {
  onSelect: (value: string) => void;
  selectedMenu: string;
}

interface MenuOption {
  label?: string;
  value: CollectionSource;
}

export const MainMenu = ({ onSelect, selectedMenu }: MainMenuProps) => {
  const { setCollectionSource } = useActions().cloud;
  const { t } = useTranslation('LWStorageService');

  const menuOptions: MenuOption[] = [
    { label: `${t('cloud.mainMenu.my_repositories')}`, value: 'owner' },
    { label: `${t('cloud.shared_with_me')}`, value: 'collaborator' },
    { label: `${t('cloud.mainMenu.organizations')}`, value: 'organization' },
  ];

  const handleClick = (value: string) => {
    onSelect(value);
    setCollectionSource(value as CollectionSource);
  };

  return (
    <Stack px={1} gap={0.5}>
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
