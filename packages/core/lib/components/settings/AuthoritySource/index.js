import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import FilterTiltShiftIcon from '@mui/icons-material/FilterTiltShift';
import { Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useActions, useAppState } from '../../../overmind';
import AuthoritySource from './AuthoritySource';
const AutoritiesPanel = () => {
    const { authorities } = useAppState().editor.lookups;
    const { reorderLookupPriority } = useActions().editor;
    const sensors = useSensors(useSensor(PointerSensor));
    const [items, setItems] = useState([]);
    useEffect(() => {
        if (!authorities)
            return;
        const authtoriesList = Object.values(authorities).sort((a, b) => a.priority - b.priority);
        setItems(authtoriesList);
        return () => { };
    }, [authorities]);
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!items || !over)
            return;
        if (active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);
            const newOrder = arrayMove(items, oldIndex, newIndex);
            setItems(newOrder);
            reorderLookupPriority(newOrder);
        }
    };
    return (React.createElement(Stack, { width: "100%", py: 1 },
        React.createElement(Stack, { direction: "row" },
            React.createElement(FilterTiltShiftIcon, { sx: { mx: 1, height: 18, width: 18 } }),
            React.createElement(Typography, null, "Entities Lookup Sources")),
        React.createElement(Typography, { ml: 4.5, variant: "caption" }, "Drag to reorder the priority"),
        React.createElement(Stack, { mt: 1, spacing: 1 }, items && (React.createElement(DndContext, { collisionDetection: closestCenter, onDragEnd: handleDragEnd, modifiers: [restrictToVerticalAxis, restrictToFirstScrollableAncestor], sensors: sensors },
            React.createElement(SortableContext, { items: items, strategy: verticalListSortingStrategy }, items.map((authority) => (React.createElement(AuthoritySource, { key: authority.id, authority: authority })))))))));
};
export default AutoritiesPanel;
//# sourceMappingURL=index.js.map