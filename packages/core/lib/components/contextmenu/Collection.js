import { Box, Collapse, Divider } from '@mui/material';
import React from 'react';
import { TransitionGroup } from 'react-transition-group';
import { v4 as uuidv4 } from 'uuid';
import Item from './Item';
import ItemsSkeleton from './ItemsSkeleton';
import Search from './Search';
const MIN_SHOW_SEARCH = 10;
const MAX_SCROLL_HEIGHT = 400;
const Collection = ({ handleQuery, collectionType = '', fullLength = 0, isLoading = false, list = [], minWidth = 250, }) => {
    return (React.createElement(React.Fragment, null, isLoading ? (React.createElement(ItemsSkeleton, { minWidth: minWidth, skeletonCount: 5 })) : (React.createElement(Box
    //reset pointer event here so that the menu items could receive mouse events
    , { 
        //reset pointer event here so that the menu items could receive mouse events
        style: { pointerEvents: 'auto' } }, fullLength === 0 ? (React.createElement(Item, { disabled: true, displayName: "No Tags Available", id: uuidv4(), icon: "block" })) : (React.createElement(React.Fragment, null,
        fullLength > MIN_SHOW_SEARCH && collectionType === 'tags' && (React.createElement(Search, { handleQuery: handleQuery })),
        list.length === 0 ? (React.createElement(Item, { disabled: true, displayName: "No Result", id: uuidv4() })) : (React.createElement(Box, { sx: {
                maxHeight: MAX_SCROLL_HEIGHT,
                overflow: 'auto',
            } },
            React.createElement(TransitionGroup, null, list.map((item) => (React.createElement(Collapse, { key: item.id }, item.type === 'divider' ? (React.createElement(Divider, { sx: { my: 0.5 }, variant: "middle" })) : (React.createElement(Item, { ...item }))))))))))))));
};
export default Collection;
//# sourceMappingURL=Collection.js.map