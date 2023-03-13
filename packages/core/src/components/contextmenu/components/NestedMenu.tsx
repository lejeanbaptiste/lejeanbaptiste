import { Menu } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useContextmenu } from '../../';
import { useWindowSize } from '../../../hooks';
import { Collection, type CollectionType } from './';
import type { ItemProps } from './Item';

interface NestedMenuProps {
  anchorEl: null | HTMLElement;
  childrenItems?: ItemProps[];
  collectionType?: CollectionType;
  isLoading?: boolean;
}

export const NestedMenu = ({
  anchorEl,
  childrenItems = [],
  collectionType,
  isLoading = false,
}: NestedMenuProps) => {
  const { MIN_WIDTH, query } = useContextmenu();
  const [visibleList, setVisibleList] = useState<ItemProps[]>(childrenItems);
  const isOpen = Boolean(Boolean(anchorEl));
  const windowSize = useWindowSize();
  const anchorBoundingClientRect = anchorEl?.getBoundingClientRect();

  useEffect(() => {
    setVisibleList(childrenItems);
    return () => {};
  }, [isLoading]);

  const handleQuery = (searchQuery: string) => {
    const result = query(childrenItems, searchQuery);
    if (!result) return setVisibleList(childrenItems);
    setVisibleList(result);
  };

  const hasSpaceToTheRight = () => {
    if (!anchorBoundingClientRect || !windowSize || !windowSize.width) return true;
    //does mindWidth submenu fits next to the origin?
    return anchorBoundingClientRect.right + MIN_WIDTH < windowSize.width;
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'top', horizontal: hasSpaceToTheRight() ? 'right' : 'left' }}
        MenuListProps={{ sx: { minWidth: MIN_WIDTH, py: 0.5, borderRadius: 1 } }}
        open={isOpen}
        PaperProps={{ elevation: 4 }}
        style={{ pointerEvents: 'none' }} // "pointerEvents: none" to prevent invisible Popover wrapper div to capture mouse events
        transitionDuration={0}
        transformOrigin={{ vertical: 'top', horizontal: hasSpaceToTheRight() ? 'left' : 'right' }}
      >
        <Collection
          collectionType={collectionType}
          fullLength={childrenItems.length}
          handleQuery={handleQuery}
          isLoading={isLoading}
          list={visibleList}
        />
      </Menu>
    </>
  );
};
