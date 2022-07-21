import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RemoveIcon from '@mui/icons-material/Remove';
import { Grid, IconButton, Paper, Stack, ToggleButton, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useActions, useAppState } from '../../../overmind';
import NamedEntityOption from './NamedEntityOption';
const AuthoritySource = ({ authorityService: { enabled, entities, id, name }, }) => {
    const { toggleLookupAuthority, toggleLookupEntity } = useActions().editor;
    const { authorities } = useAppState().editor.lookups;
    const { enqueueSnackbar } = useSnackbar();
    const [hover, setHover] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    const handleMouseOver = () => setHover(true);
    const handleMouseOut = () => setHover(false);
    const handleHadleMouseDown = () => setIsDragging(true);
    const handleHadleMouseUp = () => setIsDragging(false);
    const getNamedEntity = (name) => {
        if (entities[name] === undefined)
            return null;
        const entityEnabled = entities[name];
        return (React.createElement(NamedEntityOption, { available: enabled, enabled: entityEnabled, onClick: handleEntityToggle, name: name }));
    };
    const handleAuthorityToogle = () => {
        const authorityService = authorities[id];
        if (authorityService.requireAuth && !authorityService.config?.username) {
            enqueueSnackbar(`You must provide a username to make requests to ${id}.`, {
                variant: 'error',
            });
            return;
        }
        toggleLookupAuthority(id);
    };
    const handleEntityToggle = (entityName) => {
        toggleLookupEntity({ authorityId: id, entityName });
    };
    return (React.createElement(Paper, { elevation: isDragging ? 8 : hover ? 1 : 0, ref: setNodeRef, square: true, style: style, sx: {
            zIndex: isDragging ? 1 : 0,
            backgroundColor: isDragging ? ({ palette }) => palette.background.paper : 'transparent',
            borderRadius: 1,
            cursor: isDragging ? 'grabbing' : 'default',
        }, onMouseOver: handleMouseOver, onMouseOut: handleMouseOut, onMouseUp: handleHadleMouseUp },
        React.createElement(Grid, { container: true, alignItems: "center", sx: { height: 34, pl: 0.25 } },
            React.createElement(Grid, { item: true, xs: 5 },
                React.createElement(Stack, { direction: "row", spacing: 1, alignItems: "center" },
                    React.createElement(ToggleButton, { color: "primary", onChange: handleAuthorityToogle, selected: enabled, size: "small", sx: { border: 0 }, value: enabled }, enabled ? (React.createElement(RemoveIcon, { sx: { height: 16, width: 16, transform: 'rotate(90deg)' } })) : (React.createElement(CircleOutlinedIcon, { sx: { height: 16, width: 16 } }))),
                    React.createElement(Typography, { sx: { cursor: 'default', textTransform: 'capitalize' }, variant: "body2" }, name ?? id))),
            React.createElement(Grid, { item: true, sx: { width: 28 } }, getNamedEntity('person')),
            React.createElement(Grid, { item: true, sx: { width: 28 } }, getNamedEntity('place')),
            React.createElement(Grid, { item: true, sx: { width: 28 } }, getNamedEntity('organization')),
            React.createElement(Grid, { item: true, sx: { width: 28 } }, getNamedEntity('title')),
            React.createElement(Grid, { item: true, sx: { width: 28, pr: 1 } }, getNamedEntity('rs')),
            React.createElement(Grid, { item: true, sx: { width: 20 } },
                React.createElement(IconButton, { ...attributes, ...listeners, disableRipple: true, onMouseDown: hover ? handleHadleMouseDown : undefined, size: "small", sx: { cursor: !hover ? 'default' : isDragging ? 'grabbing' : 'grab' } },
                    React.createElement(DragIndicatorIcon, { fontSize: "inherit", sx: { pointerEvents: 'none', transition: 'height 0.3s', height: hover ? 18 : 0 } }))))));
};
export default AuthoritySource;
//# sourceMappingURL=AuthoritySource.js.map