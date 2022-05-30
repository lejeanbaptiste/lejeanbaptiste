import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import { Box, Button, Divider, IconButton, Stack, useMediaQuery, useTheme } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeasure } from 'react-use';
import type { SearchResults } from '../../../@types/types';
import { useActions, useAppState } from '../../../overmind';
import Breadcrumbs from './Breadcrumbs';
import Filename from './Filename';
import SearchBar from './searchBar';

interface TopbarProps {
  onChangeSize?: (value: DOMRect) => void;
  onOpenCreateDialog: (type: 'repo' | 'folder') => void;
}

const Topbar: FC<TopbarProps> = ({ onOpenCreateDialog, onChangeSize }) => {
  const { t } = useTranslation();
  const { dialogType } = useAppState().common;
  const { collectionSource, collectionType, name, repository, owner } = useAppState().cloud;
  const {
    checkOrgMemberWritenPermission,
    checkRepoUserWritenPermission,
    getProvider,
    searchGlobal,
  } = useActions().cloud;

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  const [showCreateButton, setShowCreateButton] = useState(false);
  const [container, containerRect] = useMeasure();

  useEffect(() => {
    onChangeSize && onChangeSize(containerRect as DOMRect);
  }, [containerRect.height]);

  useEffect(() => {
    if (dialogType === 'save') checkPermissions();
  }, [collectionSource, collectionType, owner]);

  const variants = {
    initial: { scale: 0 },
    visible: { scale: 1 },
    exit: { scale: 0 },
  };

  const handleSearchChange = async (query: string): Promise<SearchResults[] | null> => {
    return await searchGlobal(query);
  };

  const showCreateDialog = () => {
    if (!onOpenCreateDialog) return;
    repository ? onOpenCreateDialog('folder') : onOpenCreateDialog('repo');
  };

  const checkPermissions = async () => {
    setShowCreateButton(false);
    if (collectionType === 'organizations') return;

    if (collectionType === 'repos') {
      if (collectionSource === 'collaborator') return;

      const hasPermission =
        collectionSource === 'organization' || owner?.type === 'organization'
          ? await checkOrgMemberWritenPermission()
          : undefined;

      if (collectionSource === 'organization' && hasPermission) return setShowCreateButton(true);
      if (collectionSource === 'owner') {
        if (getProvider()?.username === owner?.username) return setShowCreateButton(true);
        if (owner?.type === 'organization' && hasPermission) return setShowCreateButton(true);
      }
      setShowCreateButton(false);
    }

    if (collectionType === 'content') {
      if (getProvider()?.username === owner?.username) return setShowCreateButton(true);

      const hasPermission = await checkRepoUserWritenPermission();
      if (hasPermission) return setShowCreateButton(true);

      setShowCreateButton(false);
    }
  };

  return (
    <Box ref={container}>
      <Stack spacing={1} mt={2} px={1}>
        {dialogType === 'save' ? (
          <Filename />
        ) : (
          <AnimatePresence>
            {(name === 'github' || repository) && <SearchBar onChange={handleSearchChange} />}
          </AnimatePresence>
        )}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Breadcrumbs />
          {showCreateButton && (
            <AnimatePresence>
              {isSM ? (
                <IconButton
                  component={motion.button}
                  variants={variants}
                  initial="initial"
                  animate="visible"
                  exit="exit"
                  color="primary"
                  onClick={showCreateDialog}
                  size="small"
                  data-testid={`topbar:create-${repository ? 'folder' : 'repository'}`}
                >
                  <CreateNewFolderOutlinedIcon fontSize="inherit" />
                </IconButton>
              ) : (
                <Button
                  component={motion.button}
                  variants={variants}
                  initial="initial"
                  animate="visible"
                  exit="exit"
                  onClick={showCreateDialog}
                  size="small"
                  startIcon={<AddCircleOutlineIcon fontSize="inherit" />}
                  variant="outlined"
                  data-testid={`topbar:create-${repository ? 'folder' : 'repository'}`}
                >
                  {repository ? t('cloud:breadcrumbs:folder') : t('cloud:breadcrumbs:repository')}
                </Button>
              )}
            </AnimatePresence>
          )}
        </Stack>
        <Divider />
      </Stack>
    </Box>
  );
};

export default Topbar;
