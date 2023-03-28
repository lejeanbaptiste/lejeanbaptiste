import { Box, CircularProgress, List, Skeleton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../overmind';
import { useScrollSpy } from '../hooks/useScrollSpy';
import Content from './Content';
import Empty from './Empty';
import Org from './Organization';
import Repository from './Repository';

interface Collection {
  height: number | string;
}

const Collection = ({ height = '100%' }: Collection) => {
  const { collectionType, isFetching, organizations, repositories, repositoryContent } =
    useAppState().cloud;
  const { loadMoreRepos } = useActions().cloud;

  const { t } = useTranslation();

  const refContainer = useRef<HTMLElement | null>(null);
  const refTarget = useRef<HTMLDivElement | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { reachBottom } = useScrollSpy({ container: refContainer, target: refTarget, offset: -70 });

  useEffect(() => {
    if (collectionType && reachBottom && !isLoadingMore) loadMore();
  }, [reachBottom]);

  const loadMore = async () => {
    setIsLoadingMore(true);
    await loadMoreRepos();
    setIsLoadingMore(false);
  };

  const Loading = ({ qty = 5 }: { qty?: number }) => {
    if (!qty) qty = Math.floor(Number(qty) / 58);
    const skels = new Array(qty).fill(0);
    return (
      <Box>
        {skels.map((_sk, i) => (
          <Typography key={i} variant="h5" height={46} alignItems="center" m={1} px={2} pb={1}>
            <Skeleton variant="text" />
          </Typography>
        ))}
      </Box>
    );
  };

  const LoadMore = () => (
    <Stack ref={refTarget} alignItems="center">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        m={2}
        px={2}
        borderRadius={4}
        sx={{ backgroundColor: ({ palette }) => alpha(palette.text.secondary, 0.05) }}
        onClick={loadMore}
      >
        <Typography variant="overline">{t('cloud:loading_more')}</Typography>
        {isLoadingMore && <CircularProgress size={16} />}
      </Stack>
    </Stack>
  );

  return (
    <Box ref={refContainer} height={height} sx={{ overflow: 'auto' }}>
      <List data-testid={`list-${collectionType}`} dense>
        {!collectionType || isFetching ? (
          <Loading />
        ) : collectionType === 'organizations' && organizations ? (
          <>
            {organizations.collection.length === 0 && <Empty />}
            {organizations.collection.map((item, i) => (
              <Org key={i} org={item} />
            ))}
            {organizations.hasMore && <LoadMore />}
          </>
        ) : collectionType === 'repos' && repositories ? (
          <>
            {repositories.collection.length === 0 && <Empty />}
            {repositories.collection.map((item, i) => (
              <Repository key={i} repo={item} />
            ))}
            {repositories.hasMore && <LoadMore />}
          </>
        ) : collectionType === 'content' ? (
          <>
            {repositoryContent.tree?.length === 0 && <Empty />}
            {repositoryContent.tree?.map((item, i) => (
              <Content key={i} content={item} />
            ))}
          </>
        ) : null}
      </List>
    </Box>
  );
};

export default Collection;
