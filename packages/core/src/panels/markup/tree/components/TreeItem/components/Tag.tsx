import { ListItemButton, Stack, Tooltip, alpha, useTheme } from '@mui/material';
import classNames from 'classnames';
import React, {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useItem } from '../useItem';
import { ExpandButton, Icon, ItemProps, Label, SelectionBadge } from './';

export interface TagProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'id'>, ItemProps {
  children: React.ReactNode;
  expanded?: boolean;
  expandDisabled?: boolean;
  isEntity?: boolean;
  multipleSelection?: boolean;
}

export const Tag = forwardRef<HTMLDivElement, TagProps>(
  (
    {
      canAddToMultiselection,
      classnames,
      children,
      content,
      expanded,
      expandDisabled,
      handleProps,
      isEntity,
      isOver,
      multipleSelection,
      label,
      nodeId,
      onContextMenuOpen,
      onExpand,
      onSelectItem,
      selected,
      style,
    },
    ref,
  ) => {
    const { palette } = useTheme();

    const { onPointerDown, ...handlePropsRest } = handleProps;

    const { schemaManager } = window.writer;

    const { color, icon, setHover, details } = useItem({ content, id: nodeId, isEntity, selected });

    const [multiselectable, setMultiselectable] = useState(true);
    const [selectContentOnly, setSelectContentOnly] = useState(true);

    const fullName = useMemo(() => schemaManager.getFullNameForTag(label), [label]);

    useEffect(() => {
      if (!selected) setSelectContentOnly(true);
    }, [selected]);

    const hanldeSelectItem = (event: MouseEvent<HTMLElement, Event>) => {
      if (event.shiftKey) {
        if (!multiselectable) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        onSelectItem && onSelectItem(event, { id: nodeId });
        return;
      }

      if (selected) {
        if ([schemaManager.getRoot(), schemaManager.getHeader()].includes(label)) {
          return;
        }

        setSelectContentOnly((prevValue) => {
          const newValue = !prevValue;
          onSelectItem && onSelectItem(event, { id: nodeId, contentOnly: newValue });
          return newValue;
        });

        return;
      }

      onSelectItem && onSelectItem(event, { id: nodeId, contentOnly: selectContentOnly });
    };

    const handleExpand = (event: MouseEvent<HTMLElement, globalThis.MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();
      if (expandDisabled) return;
      onExpand && onExpand();
    };

    const handleContextMenu = (event: MouseEvent<HTMLElement, globalThis.MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();

      if ([schemaManager.getRoot()].includes(label)) return;

      setSelectContentOnly(true);

      onContextMenuOpen && onContextMenuOpen(event, { id: nodeId });
    };

    const handleMouseOver = (event: MouseEvent<HTMLAnchorElement, globalThis.MouseEvent>) => {
      setHover(true);
      if (event.shiftKey && canAddToMultiselection) {
        setMultiselectable(canAddToMultiselection(nodeId));
      }
    };

    const handleMouseOut = () => {
      setHover(false);
      setMultiselectable(true);
    };

    const handleOnPointerDown = (event: PointerEvent<HTMLAnchorElement>) => {
      if (selectContentOnly) return;
      onPointerDown && onPointerDown(event);
    };

    return (
      <ListItemButton
        ref={ref}
        className={classNames(classnames)}
        selected={selected}
        onClick={hanldeSelectItem}
        onContextMenu={handleContextMenu}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        {...handlePropsRest}
        onPointerDown={handleOnPointerDown}
        style={style}
        sx={{
          py: 0.25,
          px: 0.5,
          gap: 0.5,
          borderRadius: 1,
          cursor: !multiselectable ? 'not-allowed' : 'pointer',
          '&.Mui-selected': {
            bgcolor: isEntity
              ? alpha(color, palette.action.selectedOpacity)
              : alpha(palette.primary[palette.mode], palette.action.selectedOpacity),
            '&:hover': {
              bgcolor: isEntity
                ? alpha(color, palette.action.hoverOpacity + palette.action.selectedOpacity)
                : alpha(
                    palette.primary[palette.mode],
                    palette.action.hoverOpacity + palette.action.selectedOpacity,
                  ),
            },
          },
        }}
      >
        {onExpand ? (
          <ExpandButton
            disabled={expandDisabled}
            onClick={handleExpand}
            {...{ expanded, selected }}
          />
        ) : (
          <Icon {...{ color, icon, isEntity, selected }} />
        )}
        <Tooltip
          componentsProps={{ tooltip: { sx: { textTransform: 'capitalize' } } }}
          enterDelay={1000}
          placement="right"
          title={fullName}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            width="100%"
            gap={1}
            overflow="hidden"
          >
            <Label
              details={details}
              detailsSx={{ textTransform: 'capitalize' }}
              selected={selected}
            >
              {children}
            </Label>
            {selected && !multipleSelection && <SelectionBadge contentsOnly={selectContentOnly} />}
          </Stack>
        </Tooltip>
      </ListItemButton>
    );
  },
);
