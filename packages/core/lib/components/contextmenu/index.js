import { Menu } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useActions, useAppState } from '../../overmind';
import Collection from './Collection';
import Header from './Header';
import useContextmenu from './useContextmenu';
const ContextMenu = ({ writer }) => {
    const actions = useActions();
    const { editor, ui } = useAppState();
    const { collectionType, getItems, initialize, MIN_WIDTH, query, tagName, xpath, tagMeta } = useContextmenu(writer, ui.contextMenu);
    const [menuPosition, setMenuPosition] = useState();
    const [options, setOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [show, setShow] = useState(false);
    const [visibleList, setVisibleList] = useState(options);
    useEffect(() => {
        if (!ui.contextMenu.show)
            return; //setShow(false);
        if (editor.isReadonly)
            return; //actions.ui.closeContextMenu();
        setShow(true);
        const initialzed = initialize();
        if (!initialzed)
            return; //setShow(false);
        const loadItems = async () => {
            setIsLoading(true);
            const options = await getItems();
            setIsLoading(false);
            if (!options)
                return; //setShow(false);
            setOptions(options);
            setVisibleList(options);
        };
        loadItems();
        // setShow(true);
        setMenuPosition({
            top: ui.contextMenu.position?.posY ?? 0,
            left: ui.contextMenu.position?.posX ?? 0,
        });
        return () => {
            setMenuPosition(undefined);
            setOptions([]);
            setIsLoading(false);
            setVisibleList([]);
            setShow(false);
        };
    }, [ui.contextMenu]);
    const handleQuery = (searchQuery) => {
        const result = query(options, searchQuery);
        if (!result)
            return setVisibleList(options);
        setVisibleList(result);
    };
    const handleClose = () => {
        actions.ui.closeContextMenu();
    };
    return (React.createElement(React.Fragment, null, show && (React.createElement(Menu, { anchorPosition: menuPosition, anchorReference: "anchorPosition", id: "contextmenu", keepMounted: true, MenuListProps: {
            sx: {
                minWidth: MIN_WIDTH,
                py: 0.5,
                borderRadius: 1,
            },
        }, onClose: handleClose, open: show, PaperProps: { elevation: 4 } },
        React.createElement(Header, { tagName: tagName, xpath: xpath, tagMeta: tagMeta }),
        React.createElement(Collection, { handleQuery: handleQuery, collectionType: collectionType, fullLength: options.length, isLoading: isLoading, list: visibleList, minWidth: MIN_WIDTH })))));
};
export default ContextMenu;
//# sourceMappingURL=index.js.map