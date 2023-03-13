import { ListItemButton, Stack, useTheme } from '@mui/material';
import chroma from 'chroma-js';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import React, {
  forwardRef,
  useEffect,
  useState,
  type HTMLAttributes,
  type MouseEvent,
} from 'react';
import { ElementIcon, ExpandButton, Label, SelectionBadge } from '.';
import { allowMultiselectionAtom } from '../../../store';
import { useItem } from '../useItem';

export interface ElementTagProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'id'> {
  classnames?: string[];
  children: React.ReactNode;
  expanded?: boolean;
  canAddToMultiselection?: (id: string) => boolean;
  expandDisabled?: boolean;
  handleProps?: any;
  isEntity?: boolean;
  isOver?: boolean;
  label: string;
  multipleSelection?: boolean;
  nodeId: string;
  onExpand?(): void;
  onSelectItem?: (
    event: MouseEvent<HTMLElement, Event>,
    { id, contentOnly }: { id: string; contentOnly?: boolean }
  ) => void;
  onContextMenuOpen?: (
    event: MouseEvent<HTMLElement, Event>,
    id: string,
    contentOnly?: boolean
  ) => void;
  selected?: boolean;
}

export const ElementTag = forwardRef<HTMLDivElement, ElementTagProps>(
  (
    {
      classnames,
      children,
      canAddToMultiselection,
      expanded,
      expandDisabled,
      handleProps,
      isEntity,
      isOver,
      multipleSelection,
      label,
      nodeId,
      onExpand,
      onSelectItem,
      onContextMenuOpen,
      selected,
      style,
    },
    ref
  ) => {
    const allowMultiselection = useAtomValue(allowMultiselectionAtom);

    const { palette } = useTheme();

    const { color, icon } = useItem(nodeId, isEntity);

    const { writer } = window;

    const [hover, setHover] = useState(false);
    const [showFullName, setShowFullName] = useState(false);
    const [selectContentsOnly, setSelectContentsOnly] = useState(true);
    const [multiselectable, setMultiselectable] = useState(true);

    const fullName = writer.schemaManager.getFullNameForTag(label);

    useEffect(() => {
      if (!selected) setSelectContentsOnly(true);
    }, [selected]);

    useEffect(() => {
      let timer: NodeJS.Timeout;
      if (hover) {
        timer = setTimeout(() => {
          if (hover) setShowFullName(true);
        }, 2000);
      } else {
        setShowFullName(false);
        clearTimeout(timer);
      }
      return () => clearTimeout(timer);
    }, [hover]);

    const hanldeSelectItem = (event: MouseEvent<HTMLElement, Event>) => {
      if (allowMultiselection && event.shiftKey) {
        if (!multiselectable) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        onSelectItem(event, { id: nodeId });
        return;
      }

      if (selected) {
        if (
          label === writer.schemaManager.getRoot() ||
          label === writer.schemaManager.getHeader()
        ) {
          return;
        }

        setSelectContentsOnly((prevValue) => {
          const newValue = !prevValue;
          onSelectItem(event, { id: nodeId, contentOnly: newValue });
          return newValue;
        });

        return;
      }

      onSelectItem(event, { id: nodeId, contentOnly: selectContentsOnly });
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

      setSelectContentsOnly(true);

      onContextMenuOpen(event, nodeId);
    };

    const handleMouseOver = (event: MouseEvent<HTMLAnchorElement, globalThis.MouseEvent>) => {
      setHover(true);
      if (allowMultiselection && event.shiftKey) setMultiselectable(canAddToMultiselection(nodeId));
    };

    const handleMouseOut = () => {
      setHover(false);
      setMultiselectable(true);
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
        {...handleProps}
        style={style}
        sx={{
          py: 0.25,
          px: 0.5,
          gap: 0.5,
          borderRadius: 1,
          cursor: !multiselectable ? 'not-allowed' : 'pointer',
          // border: isOver ? `1px dashed ${palette.primary[palette.mode]}` : 'inherit',
          '&.Mui-selected': {
            bgcolor: isEntity
              ? chroma(color).alpha(palette.action.selectedOpacity).css()
              : chroma(palette.primary[palette.mode]).alpha(palette.action.selectedOpacity).css(),
            '&:hover': {
              bgcolor: isEntity
                ? chroma(color)
                    .alpha(palette.action.hoverOpacity + palette.action.selectedOpacity)
                    .css()
                : chroma(palette.primary[palette.mode])
                    .alpha(palette.action.hoverOpacity + palette.action.selectedOpacity)
                    .css(),
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
          <ElementIcon {...{ color, icon, isEntity, selected }} />
        )}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          width="100%"
          gap={1}
          overflow="hidden"
        >
          <Label fullName={fullName} selected={selected} showFullName={showFullName}>
            {children}
          </Label>
          {selected && !multipleSelection && <SelectionBadge contentsOnly={selectContentsOnly} />}
        </Stack>
      </ListItemButton>
    );
  }
);
