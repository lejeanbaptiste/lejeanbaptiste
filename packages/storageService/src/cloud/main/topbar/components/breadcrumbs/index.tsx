import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import {
  Breadcrumbs as BreadcrumbsMui,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../../../overmind';
import { Crumb } from './Crumb';

export const Breadcrumbs = () => {
  const { collectionSource, collectionType, repositoryContent, owner, repository } =
    useAppState().cloud;
  const { navigateBack, navigateTo } = useActions().cloud;

  const { t } = useTranslation('LWStorageService');

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  const pathLength = repositoryContent.path?.length ?? 0;

  const handleClickOrgs = () => navigateBack('organizations');
  const handleClickOwner = () => navigateBack('repositories');
  const handleClickRepo = () => navigateTo({ repo: repository });
  const handleDeepNavigation = (level: number) => navigateBack(level + 1);
  const handleClickBack = () => navigateBack(-1);

  return (
    <Stack direction="row" alignItems="flex-end" minHeight={39} pl={1}>
      {isSM && collectionType === 'content' && (
        <IconButton onClick={handleClickBack} size="small">
          <ArrowBackIosNewIcon fontSize="inherit" />
        </IconButton>
      )}

      <BreadcrumbsMui
        aria-label="breadcrumb"
        itemsBeforeCollapse={isSM ? 1 : 2}
        itemsAfterCollapse={1}
        maxItems={isSM ? 2 : 6}
        sx={{ '& ol': { alignItems: 'flex-end' } }}
      >
        {collectionType === 'organizations' && (
          <Typography mt={2} sx={{ textTransform: 'capitalize' }}>
            {t('cloud.breadcrumbs.organizations')}
          </Typography>
        )}

        {collectionType === 'repos' && collectionSource === 'organization' && (
          <Crumb
            level={-1}
            name={`${t('cloud.breadcrumbs.organizations')}`}
            onClick={handleClickOrgs}
          />
        )}

        {owner && collectionType === 'repos' && collectionSource !== 'collaborator' ? (
          <Crumb
            disabled={!repository}
            label={`${t('cloud.breadcrumbs.owner')}`}
            level={-2}
            name={owner.username}
            onClick={handleClickOwner}
          />
        ) : (
          collectionType === 'repos' && (
            <Typography mt={2} sx={{ textTransform: 'capitalize' }}>
              {t('cloud.breadcrumbs.repositories')}
            </Typography>
          )
        )}

        {collectionType === 'content' && !isSM && (
          <Crumb
            disabled={!repository}
            label={`${t('cloud.breadcrumbs.owner')}`}
            level={-1}
            name={repository?.owner?.username}
            onClick={handleClickOwner}
          />
        )}
        {collectionType === 'content' && (
          <Crumb
            color={'primary'}
            disabled={repositoryContent.path && repositoryContent.path[0] === ''}
            label={`${t('cloud.breadcrumbs.repository')}`}
            level={0}
            name={repository?.name}
            onClick={handleClickRepo}
            writePermission={repository?.writePermission}
          />
        )}
        {collectionType === 'content' && (
          <Crumb
            disabled={true}
            label={`${t('cloud.breadcrumbs.branch')}`}
            level={0}
            name={repository?.default_branch}
            onClick={handleClickRepo}
          />
        )}
        {collectionType === 'content' &&
          repositoryContent.path?.map((location, level) => (
            <Crumb
              key={level}
              color={level === pathLength - 1 ? 'primary' : 'inherit'}
              disabled={level == pathLength - 1}
              level={level}
              name={location}
              onClick={() => handleDeepNavigation(level)}
            />
          ))}
      </BreadcrumbsMui>
    </Stack>
  );
};
