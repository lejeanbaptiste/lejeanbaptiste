import SearchIcon from '@mui/icons-material/Search';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../overmind';
import type { Owner } from '../../../../types';
import { log } from '../../../../utilities';
import { SideButton } from '../SideButton';
import { SearchBar } from './searchBar';

export { SearchBar } from './searchBar';

interface PublicRepositoriesProps {
  onSelect: (username: string) => void;
  selectedMenu: string;
}

const searcbarCollapsible = false;

export const PublicRepositories = ({ onSelect, selectedMenu }: PublicRepositoriesProps) => {
  const { owner, name: providerName, publicRepositories } = useAppState().cloud;

  const {
    addPublicRepository,
    getProvider,
    getPublicRepository,
    removePublicRepository,
    searchUsers,
    setOwner,
  } = useActions().cloud;

  const { t } = useTranslation();

  const options = providerName ? publicRepositories?.[providerName] ?? [] : [];
  const [showSearch, setShowSearch] = useState(!searcbarCollapsible);

  useEffect(() => {
    setShowSearch(!searcbarCollapsible);
  }, [providerName]);

  useEffect(() => {
    if (!owner || !providerName) return;
    const provider = getProvider();
    if (provider?.username === owner.username) return;

    const { id, name, type, username } = owner;

    if (!publicRepositories?.[providerName]) {
      addPublicRepository({ id, name, type, username });
      onSelect(username);
      return;
    }

    const ownerOfPublicRepo = publicRepositories?.[providerName].find(
      (user: Owner) => user.username === owner.username
    );

    if (!ownerOfPublicRepo && provider?.username !== username) {
      addPublicRepository({ id, name, type, username });
    }

    onSelect(username);
  }, [owner]);

  const handleClick = (value: string) => {
    const owner = getPublicRepository(value);
    if (!owner) return log.warn('public repository not found');
    onSelect(owner.username);
    setOwner(owner);
  };

  const handleDelete = (value: string) => removePublicRepository(value);

  const handleShowSearch = () => setShowSearch(true);
  const handleCloseSearch = () => setShowSearch(searcbarCollapsible ? false : true);

  const handleSearchSelect = (owner: Owner) => {
    addPublicRepository(owner);
    setOwner(owner);
    onSelect(owner.username);
  };

  const handleSearchChange = async (query: string) => await searchUsers(query);

  return (
    <Box>
      <Stack spacing={1}>
        <Stack
          direction={showSearch ? 'column' : 'row'}
          alignItems={showSearch ? 'flex-start' : 'center'}
          justifyContent="space-between"
          spacing={1}
          pl={2}
          pr={1.5}
        >
          <Typography fontWeight={600}>
            {t('cloud:publicRepositories:public_repositories')}
          </Typography>
          <AnimatePresence>
            {!showSearch ? (
              <IconButton
                aria-label="search public repositories"
                onClick={handleShowSearch}
                size="small"
              >
                <SearchIcon fontSize="inherit" />
              </IconButton>
            ) : (
              <SearchBar
                collapsible={searcbarCollapsible}
                onClear={handleCloseSearch}
                onChange={handleSearchChange}
                onSelect={handleSearchSelect}
              />
            )}
          </AnimatePresence>
        </Stack>
        {providerName && publicRepositories?.[providerName] && (
          <Stack>
            {options.map(({ name, username, type }) => (
              <SideButton
                key={username}
                active={selectedMenu === username}
                label={name ?? username}
                onClick={handleClick}
                onDelete={handleDelete}
                type={type}
                value={username}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};
