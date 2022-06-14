import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { IconButton, ListSubheader, MenuItem, Stack } from '@mui/material';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionSource, Owner } from '../../types';
import { useActions, useAppState } from '../../overmind';
import { log } from '../../utilities/log';
import SearchBar from './publicRepository/searchBar';

interface MobileMenuProps {
  onSelect: (value: string) => void;
  selectedMenu: string;
}

interface MenuOption {
  label?: string;
  value: CollectionSource;
}

const MobileMenu: FC<MobileMenuProps> = ({ onSelect, selectedMenu }) => {
  const { t } = useTranslation();
  const { addPublicRepository, getPublicRepository, searchUsers, setCollectionSource, setOwner } =
    useActions().cloud;

  const { name: providerName, publicRepositories } = useAppState().cloud;
  const publicOptions = providerName ? publicRepositories?.[providerName] ?? [] : [];

  const [showSearch, setShowSearch] = useState(false);

  const menuOptions: MenuOption[] = [
    { label: t('cloud:mainMenu:my_repositories'), value: 'owner' },
    { label: t('cloud:mainMenu:shared_with_me'), value: 'collaborator' },
    { label: t('cloud:mainMenu:organizations'), value: 'organization' },
  ];

  const handleChange = (event: SelectChangeEvent) => {
    const value = event.target.value as string;

    const isOnwer = menuOptions.some((ownerOption) => ownerOption.value === value);

    if (isOnwer) {
      setCollectionSource(value as CollectionSource);
    } else {
      const owner = getPublicRepository(value);
      if (!owner) return log.warn('public repository not found');
      onSelect(owner.username);
      setOwner(owner);
    }

    onSelect(value);
  };

  const toggleSearchBar = () => setShowSearch(!showSearch);

  const handleSearchSelect = (owner: Owner) => {
    addPublicRepository(owner);
    setOwner(owner);
    setShowSearch(false);
    onSelect(owner.username);
  };

  const handleCloseSearch = () => setShowSearch(false);
  const handleSearchChange = async (query: string) => await searchUsers(query);

  return (
    <Stack direction="row" px={1} width="100%">
      {showSearch ? (
        <SearchBar
          collapsible={false}
          onClear={handleCloseSearch}
          onChange={handleSearchChange}
          onSelect={handleSearchSelect}
        />
      ) : (
        <Select fullWidth onChange={handleChange} value={selectedMenu} variant="standard">
          {menuOptions.map(({ label, value }) => (
            <MenuItem key={value} value={value}>
              {label ?? value}
            </MenuItem>
          ))}

          {publicOptions.length && (
            <ListSubheader>{t('cloud:publicRepositories:public_repositories')}</ListSubheader>
          )}

          {publicOptions.map(({ name, username }) => (
            <MenuItem key={username} value={username}>
              {name ?? username}
            </MenuItem>
          ))}
        </Select>
      )}

      <IconButton onClick={toggleSearchBar}>
        {showSearch ? <CloseIcon /> : <SearchIcon />}
      </IconButton>
    </Stack>
  );
};

export default MobileMenu;
