import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { IconButton, MenuItem, Stack } from '@mui/material';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import { useLiveQuery } from 'dexie-react-hooks';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../../db';
import { useActions, useAppState } from '../../../overmind';
import type { CollectionSource, Owner, PublicRepository } from '../../../types';
import { log } from '../../../utilities';
import { SearchBar } from './publicRepository';
import { usePublicRepository } from './publicRepository/usePublicRepositoty';

interface MobileMenuProps {
  onSelect: (value: string) => void;
  selectedMenu: string;
}

interface MenuOption {
  label?: string;
  value: CollectionSource | 'public';
}

export const MobileMenu = ({ onSelect, selectedMenu }: MobileMenuProps) => {
  const { name: providerName } = useAppState().cloud;
  const { searchUsers, setCollectionSource, setOwner } = useActions().cloud;

  const { t } = useTranslation();

  const { addPublicRepository, getPublicRepositoryByUsername } = usePublicRepository();

  const publicRepositories = useLiveQuery(() => db.publicRepositories.toArray()) ?? [];

  const [showSearch, setShowSearch] = useState(false);
  const [mainMenuSelection, setMainMenuSelection] = useState<CollectionSource | 'public'>('owner');

  const menuOptions: MenuOption[] = [
    { label: `${t('cloud:mainMenu:my_repositories')}`, value: 'owner' },
    { label: `${t('cloud:shared_with_me')}`, value: 'collaborator' },
    { label: `${t('cloud:mainMenu:organizations')}`, value: 'organization' },
    { label: `${t('cloud:publicRepositories:public_repositories')}`, value: 'public' },
  ];

  useEffect(() => {
    if (menuOptions.some((item) => item.value === selectedMenu)) {
      setMainMenuSelection(selectedMenu as CollectionSource);
      setCollectionSource(selectedMenu as CollectionSource);
      onSelect(selectedMenu);
    } else {
      setMainMenuSelection('public');
    }
  }, []);

  const handleChangeMainMenu = async (event: SelectChangeEvent) => {
    const value = event.target.value as CollectionSource | 'public';

    setMainMenuSelection(value);

    if (value === 'public') return;

    setCollectionSource(value as CollectionSource);
    onSelect(value);
  };

  const handleChange = async (event: SelectChangeEvent) => {
    const value = event.target?.value as string;
    if (!value) return;

    const isOnwer = menuOptions.some((ownerOption) => ownerOption.value === value);

    if (isOnwer) {
      setCollectionSource(value as CollectionSource);
    } else {
      const publicRepository = await getPublicRepositoryByUsername(value);
      if (!publicRepository) return log.warn('public repository not found');

      const { uuid, provider, ...rest } = publicRepository;
      setOwner(rest as Owner);
    }

    onSelect(value);
  };

  const toggleSearchBar = () => setShowSearch(!showSearch);

  const handleSearchSelect = async (publicRepository: PublicRepository) => {
    await addPublicRepository(publicRepository);

    const { uuid, provider, ...rest } = publicRepository;
    setOwner(rest as Owner);

    setShowSearch(false);
    onSelect(uuid);
  };

  const handleCloseSearch = () => setShowSearch(false);
  const handleSearchChange = async (query: string) => await searchUsers(query);

  return (
    <Stack px={1} gap={1}>
      <Select
        fullWidth
        onChange={handleChangeMainMenu}
        sx={{ textTransform: 'capitalize' }}
        value={mainMenuSelection}
        variant="standard"
      >
        {menuOptions.map(({ label, value }) => (
          <MenuItem key={value} sx={{ textTransform: 'capitalize' }} value={value}>
            {label ?? value}
          </MenuItem>
        ))}
      </Select>
      {mainMenuSelection === 'public' && (
        <Stack direction="row" width="100%">
          {showSearch ? (
            <SearchBar
              collapsible={false}
              onClear={handleCloseSearch}
              onChange={handleSearchChange}
              onSelect={handleSearchSelect}
            />
          ) : (
            <Select fullWidth onChange={handleChange} value={selectedMenu} variant="standard">
              {publicRepositories
                .filter((item) => item.provider === providerName)
                .map(({ name, username }) => (
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
      )}
    </Stack>
  );
};
