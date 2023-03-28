import { Box, Divider } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import { useAtomValue } from 'jotai';
import React, { useEffect, useState } from 'react';
import { showOnlyValidAtom } from '../../store';
import { Item, NoResultItem, type ItemProps } from '../item';
import { Filters, Skeleton } from './components';

interface CollectionsProps {
  isLoading?: boolean;
  list: ItemProps[];
  searchable?: boolean;
}

const MIN_SHOW_SEARCH = 10;
const MAX_SCROLL_HEIGHT = 420;

export const Collection = ({ isLoading = false, list, searchable = false }: CollectionsProps) => {
  const onlyValid = useAtomValue(showOnlyValidAtom);
  
  const [activeItem, setActiveItem] = useState<string>();
  const [query, setQuery] = useState('');

  const applyFilters = (list: ItemProps[]) => {
    return list
      .filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()))
      .filter((item) => (onlyValid ? !item.invalid : item));
  };

  const [visibleList, setVisibleList] = useState<ItemProps[]>(applyFilters(list));

  useEffect(() => {
    setVisibleList(applyFilters(list));
  }, [list, query, onlyValid]);

  const handleQuery = (query: string) => setQuery(query);

  const handleMouseEnter = (id: string = '') => setActiveItem(id);

  return (
    //reset pointer event here so that the menu items could receive mouse events
    <Box style={{ pointerEvents: 'auto' }}>
      {isLoading ? (
        <Skeleton />
      ) : (
        <Box>
          {searchable && list.length > MIN_SHOW_SEARCH && <Filters onQuery={handleQuery} />}
          <Box overflow="auto" pt={0.5} sx={{ maxHeight: MAX_SCROLL_HEIGHT }}>
            <AnimatePresence>
              {visibleList.length === 0 ? (
                <NoResultItem />
              ) : (
                visibleList.map((item, index) =>
                  item.type === 'divider' ? (
                    <Divider key={index.toString()} sx={{ my: 0.5 }} variant="middle" />
                  ) : (
                    <Item
                      key={item.name}
                      {...item}
                      active={activeItem === (item.id ?? item.name)}
                      id={item.id ?? item.name}
                      onMouseEnter={handleMouseEnter}
                    />
                  )
                )
              )}
            </AnimatePresence>
          </Box>
        </Box>
      )}
    </Box>
  );
};
