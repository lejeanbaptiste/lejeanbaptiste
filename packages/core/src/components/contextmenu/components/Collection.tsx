import { Box, Divider } from '@mui/material';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Item, ItemsSkeleton, Search, type ItemProps } from './';

export type CollectionType = 'tags';

interface CollectionProps {
  collectionType?: CollectionType;
  fullLength?: number;
  handleQuery?: (query: string) => void;
  isLoading?: boolean;
  list?: ItemProps[];
}

const MIN_SHOW_SEARCH = 10;
const MAX_SCROLL_HEIGHT = 400;

export const Collection = ({
  collectionType,
  fullLength = 0,
  handleQuery,
  isLoading = false,
  list = [],
}: CollectionProps) => {
  const [activeItem, setActiveItem] = useState<string>();

  const container: Variants = {
    hidden: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
    show: { transition: { staggerChildren: 0.04 } },
  };

  const itemVariants: Variants = {
    hidden: { y: -10, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  return (
    <>
      {/* LOADER */}
      {isLoading ? (
        <ItemsSkeleton />
      ) : (
        //reset pointer event here so that the menu items could receive mouse eventsƒ
        <Box style={{ pointerEvents: 'auto' }}>
          {/* SHOW NO TAGS AVAILABLE */}
          {fullLength === 0 ? (
            <Item disabled={true} displayName="No Tags Available" id={uuidv4()} icon="block" />
          ) : (
            <>
              {/* SHOW SEARCH */}
              {handleQuery && fullLength > MIN_SHOW_SEARCH && collectionType === 'tags' && (
                <Search handleQuery={handleQuery} />
              )}

              {/* SHOW NO RESULT */}
              {list.length === 0 ? (
                <Item disabled={true} displayName="No Result" id={uuidv4()} />
              ) : (
                <Box
                  component={motion.div}
                  variants={container}
                  initial={false}
                  animate="show"
                  exit="hidden"
                  overflow="auto"
                  sx={{ maxHeight: MAX_SCROLL_HEIGHT }}
                >
                  {/* COLLAPSIBLE LIST */}
                  <AnimatePresence mode="popLayout">
                    {list.map((item) => (
                      <Box
                        component={motion.div}
                        key={item.id}
                        variants={itemVariants}
                        initial={false}
                        animate="show"
                        exit="hidden"
                        layout
                      >
                        {item.type === 'divider' ? (
                          <Divider sx={{ my: 0.5 }} variant="middle" />
                        ) : (
                          <Item
                            {...item}
                            active={activeItem === item.id}
                            onMouseEnter={(id) => setActiveItem(id)}
                            onMouseLeave={() => setActiveItem(undefined)}
                          />
                        )}
                      </Box>
                    ))}
                  </AnimatePresence>
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </>
  );
};

// // export default Collection;
// <Box sx={{ maxHeight: MAX_SCROLL_HEIGHT, overflow: 'auto' }}>
//   {/* COLLAPSIBLE LIST */}
//   <TransitionGroup>
//     {list.map((item) => (
//       <Collapse key={item.id}>
//         {item.type === 'divider' ? (
//           <Divider sx={{ my: 0.5 }} variant="middle" />
//         ) : (
//           <Item {...item} />
//         )}
//       </Collapse>
//     ))}
//   </TransitionGroup>
// </Box>;
