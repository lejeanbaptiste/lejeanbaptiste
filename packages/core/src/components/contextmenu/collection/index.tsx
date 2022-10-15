import { Box, Collapse, Divider } from '@mui/material';
import React, { type FC } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { v4 as uuidv4 } from 'uuid';
import type { IItem } from './Item';
import Item from './Item';
import ItemsSkeleton from './ItemsSkeleton';
import Search from './Search';

interface CollectionProps {
  collectionType?: string;
  fullLength?: number;
  handleQuery: (query: string) => void;
  isLoading?: boolean;
  list?: IItem[];
  minWidth?: number;
}

const MIN_SHOW_SEARCH = 10;
const MAX_SCROLL_HEIGHT = 400;

const Collection: FC<CollectionProps> = ({
  collectionType = '',
  fullLength = 0,
  handleQuery,
  isLoading = false,
  list = [],
  minWidth = 250,
}) => {
  return (
    <>
      {/* LOADER */}
      {isLoading ? (
        <ItemsSkeleton minWidth={minWidth} skeletonCount={5} />
      ) : (
        //reset pointer event here so that the menu items could receive mouse eventsƒ
        <Box style={{ pointerEvents: 'auto' }}>
          {/* SHOW NO TAGS AVAILABLE */}
          {fullLength === 0 ? (
            <Item disabled={true} displayName="No Tags Available" id={uuidv4()} icon="block" />
          ) : (
            <>
              {/* SHOW SEARCH */}
              {fullLength > MIN_SHOW_SEARCH && collectionType === 'tags' && (
                <Search handleQuery={handleQuery} />
              )}

              {/* SHOW NO RESULT */}
              {list.length === 0 ? (
                <Item disabled={true} displayName="No Result" id={uuidv4()} />
              ) : (
                <Box sx={{ maxHeight: MAX_SCROLL_HEIGHT, overflow: 'auto' }}>
                  {/* COLLAPSIBLE LIST */}
                  <TransitionGroup>
                    {list.map((item) => (
                      <Collapse key={item.id}>
                        {item.type === 'divider' ? (
                          <Divider sx={{ my: 0.5 }} variant="middle" />
                        ) : (
                          <Item {...item} />
                        )}
                      </Collapse>
                    ))}
                  </TransitionGroup>
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </>
  );
};

export default Collection;
