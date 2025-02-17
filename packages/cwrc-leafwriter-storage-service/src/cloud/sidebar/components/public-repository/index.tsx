import SearchIcon from '@mui/icons-material/Search';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { db } from '@src/db';
import { useActions, useAppState } from '@src/overmind';
import type { Owner, PublicRepository } from '@src/types';
import { log } from '@src/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { debounce } from 'lodash';
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SideButton } from '../side-button';
import { SearchBar } from './search-bar';
import { usePublicRepository } from './usePublicRepositoty';

export { SearchBar } from './search-bar';

interface PublicRepositoriesProps {
  onSelect: (username: string) => void;
  selectedMenu: string;
}

const searcbarCollapsible = false;

export const PublicRepositories = ({ onSelect, selectedMenu }: PublicRepositoriesProps) => {
  const { name: providerName, owner } = useAppState().cloud;
  const { searchUsers, setOwner } = useActions().cloud;

  const { t } = useTranslation();

  const { addPublicRepository, getPublicRepositoryByUsername, removePublicRepository } =
    usePublicRepository();

  const publicRepositories = useLiveQuery(() => db.publicRepositories?.toArray()) ?? [];

  const [showSearch, setShowSearch] = useState(!searcbarCollapsible);

  useEffect(() => {
    setShowSearch(!searcbarCollapsible);
  }, [providerName]);

  useEffect(() => {}, [owner]);

  const fetch = debounce(
    async (value: string) => {
      const publicRepository = await getPublicRepositoryByUsername(value);
      if (!publicRepository) return log.warn('public repository not found');

      const { uuid, provider, ...user } = publicRepository;
      setOwner(user as Owner);
      onSelect(user.username);
    },
    500,
    { leading: true, trailing: false },
  );

  const handleClick = (value: string) => {
    fetch(value);
  };

  const handleDelete = (value: string) => removePublicRepository(value);

  const handleShowSearch = () => setShowSearch(true);
  const handleCloseSearch = () => setShowSearch(searcbarCollapsible ? false : true);

  const handleSearchSelect = async (publicRepository: PublicRepository) => {
    await addPublicRepository(publicRepository);

    const { uuid, provider, ...user } = publicRepository;
    setOwner(user as Owner);

    onSelect(user.username);
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
            {t('SS.cloud.publicRepositories.public_repositories')}
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
        {providerName && (
          <Stack height={250} px={1} gap={0.5} overflow="auto">
            <AnimatePresence>
              {publicRepositories
                .filter((item) => item.provider === providerName)
                .map(({ name, username, type, uuid }) => (
                  <SideButton
                    key={username}
                    active={selectedMenu === username}
                    label={name ?? username}
                    onClick={handleClick}
                    onDelete={handleDelete}
                    type={type}
                    uuid={uuid}
                    value={username}
                  />
                ))}
            </AnimatePresence>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};
