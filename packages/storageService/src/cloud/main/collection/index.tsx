import { Box, List } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { useActions, useAppState } from '../../../overmind';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import { Content, Empty, LoadMore, Organization, Repository, Skeletons } from './components';

interface Collection {
  height: number | string;
}

export const Collection = ({ height = '100%' }: Collection) => {
  const { collectionType, isFetching, organizations, repositories, repositoryContent } =
    useAppState().cloud;
  const { loadMoreRepos } = useActions().cloud;

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

  return (
    <Box ref={refContainer} height={height} sx={{ overflow: 'auto' }}>
      <List data-testid={`list-${collectionType}`} dense>
        {!collectionType || isFetching ? (
          <Skeletons />
        ) : collectionType === 'organizations' && organizations ? (
          <>
            {organizations.collection.length === 0 && <Empty />}
            {organizations.collection.map((item, i) => (
              <Organization key={i} organization={item} />
            ))}
            {organizations.hasMore && <LoadMore {...{ isLoadingMore, loadMore, refTarget }} />}
          </>
        ) : collectionType === 'repos' && repositories ? (
          <>
            {repositories.collection.length === 0 && <Empty />}
            {repositories.collection.map((item, i) => (
              <Repository key={i} repository={item} />
            ))}
            {repositories.hasMore && <LoadMore {...{ isLoadingMore, loadMore, refTarget }} />}
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
