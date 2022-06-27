import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BlockIcon from '@mui/icons-material/Block';
import { Box, CircularProgress, MenuItem, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { forwardRef, useEffect, useState } from 'react';
import { useActions } from '../../overmind';
import { EntityType } from '../../types';
import useUI from '../useUI';
import NestedMenu from './NestedMenu';
const Item = forwardRef(({ disabled = false, name, displayName, collectionType, description, icon, childrenItems, onClick, type, }, ref) => {
    const theme = useTheme();
    const { ui } = useActions();
    const { getIcon } = useUI();
    const [anchorEl, setAnchorEl] = useState(null);
    const [showChildren, setShowChildren] = useState(false);
    const [children, setChildren] = useState([]);
    const [isLoadingChildren, setIsLoadingChildren] = useState(false);
    useEffect(() => {
        if (childrenItems && Array.isArray(childrenItems))
            setChildren(childrenItems);
        const loadChildren = async () => {
            if (childrenItems && !Array.isArray(childrenItems)) {
                setIsLoadingChildren(true);
                const list = await childrenItems();
                setChildren(list);
                setIsLoadingChildren(false);
            }
        };
        if (childrenItems && !Array.isArray(childrenItems))
            loadChildren();
        return () => { };
    }, []);
    const hasChildrenItems = childrenItems ?? false;
    const getEntityIcon = () => {
        if (Object.values(EntityType).includes(name)) {
            return getIcon(theme.entity[name].icon);
        }
        return getIcon(icon);
    };
    const Icon = type === 'entity' ? getEntityIcon() : getIcon(icon);
    const color = () => {
        if (!name)
            return 'inherent';
        if (Object.values(EntityType).includes(name)) {
            return theme.entity[name].color.main;
        }
        return 'inherent';
    };
    const handleMouseEnter = (event) => {
        setAnchorEl(event.currentTarget);
        setShowChildren(true);
    };
    const handleClose = () => {
        setShowChildren(false);
    };
    const handleMouseEnterMenu = () => {
        setShowChildren(true);
    };
    const handleCloseMenu = () => {
        setAnchorEl(null);
        setShowChildren(false);
    };
    const handleClick = () => {
        if (!onClick)
            return;
        handleCloseMenu();
        ui.closeContextMenu();
        onClick();
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(MenuItem, { dense: true, disabled: disabled, onClick: handleClick, onMouseEnter: handleMouseEnter, onMouseLeave: handleClose, sx: {
                mx: 0.5,
                px: 0.75,
                borderRadius: 1,
                '&:hover': {
                    color: color(),
                    backgroundColor: ({ palette }) => color() === 'inherent' ? 'inherent' : alpha(color(), palette.action.hoverOpacity),
                },
            }, ref: ref },
            React.createElement(Box, { sx: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    columnGap: 1,
                } },
                Icon && React.createElement(Icon, { sx: { height: 18, width: 18, color: color() } }),
                React.createElement(Box, { sx: { flexGrow: 1 } },
                    React.createElement(Typography, { variant: "body2" }, displayName),
                    description && (React.createElement(Typography, { color: "text.secondary", variant: "caption" }, description))),
                hasChildrenItems &&
                    (isLoadingChildren ? (React.createElement(CircularProgress, { size: 16, thickness: 5 })) : children.length === 0 ? (React.createElement(BlockIcon, { color: "error", sx: { fontSize: 16 } })) : (React.createElement(ArrowForwardIosIcon, { sx: { fontSize: 12 } }))))),
        hasChildrenItems && (children.length > 0 || isLoadingChildren) && showChildren && (React.createElement(NestedMenu, { anchorEl: anchorEl, handleClose: handleCloseMenu, handleMouseEnter: handleMouseEnterMenu, childrenItems: children, collectionType: collectionType, isLoading: isLoadingChildren }))));
});
export default Item;
//# sourceMappingURL=Item.js.map