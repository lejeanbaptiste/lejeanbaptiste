import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import BlockIcon from '@mui/icons-material/Block';
import { CircularProgress, Icon, MenuItem, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { forwardRef, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { getIcon, type IconLeafWriter } from '../../../icons';
import { useActions } from '../../../overmind';
import { EntityType } from '../../../types';
import type { CollectionType } from './';
import { NestedMenu } from './NestedMenu';

export type Type = 'tag' | 'entity' | 'divider' | 'search';

export interface ItemProps {
  active?: boolean;
  childrenItems?: ItemProps[] | (() => Promise<ItemProps[]>);
  collectionType?: CollectionType;
  description?: string;
  disabled?: boolean;
  displayName?: string;
  icon?: IconLeafWriter;
  id: string;
  name?: EntityType | string;
  onClick?: () => void;
  onMouseEnter?: (id: string) => void;
  onMouseLeave?: () => void;
  type?: Type;
}

export const Item = forwardRef<any, ItemProps>(
  (
    {
      active,
      id,
      childrenItems,
      collectionType,
      description,
      displayName,
      disabled = false,
      icon,
      name,
      onClick,
      onMouseEnter,
      onMouseLeave,
      type,
    },
    ref
  ) => {
    const theme = useTheme();
    const { ui } = useActions();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [showChildren, setShowChildren] = useState(false);
    const [children, setChildren] = useState<ItemProps[]>([]);
    const [isLoadingChildren, setIsLoadingChildren] = useState(false);

    useEffect(() => {
      if (childrenItems && Array.isArray(childrenItems)) setChildren(childrenItems);
      const loadChildren = async () => {
        if (childrenItems && !Array.isArray(childrenItems)) {
          setIsLoadingChildren(true);
          const list = await childrenItems();
          setChildren(list);
          setIsLoadingChildren(false);
        }
      };
      if (childrenItems && !Array.isArray(childrenItems)) loadChildren();
      return () => {};
    }, []);

    useEffect(() => {
      setShowChildren(active);
    }, [active]);

    const hasChildrenItems = childrenItems ?? false;

    const getEntityIcon = () => {
      if (Object.values(EntityType).includes(name as EntityType)) {
        return getIcon(theme.entity[name as EntityType].icon as IconLeafWriter);
      }
      return getIcon(icon);
    };

    const color = useMemo(() => {
      if (!name) return 'inherent';
      if (Object.values(EntityType).includes(name as EntityType)) {
        return theme.entity[name as EntityType].color.main;
      }
      return 'inherent';
    }, [name]);

    const handleMouseEnter = (event: MouseEvent<HTMLElement, globalThis.MouseEvent>) => {
      setAnchorEl(event.currentTarget);
      onMouseEnter && onMouseEnter(id);
    };

    const handleClick = () => {
      if (!onClick) return;
      ui.closeContextMenu();
      onClick();
    };

    return (
      <>
        <MenuItem
          dense
          disabled={disabled}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          sx={{
            mx: 0.5,
            px: 0.75,
            borderRadius: 1,
            '&:hover': {
              color,
              bgcolor: ({ palette }) =>
                color === 'inherent' ? 'inherent' : alpha(color, palette.action.hoverOpacity),
            },
          }}
          selected={active}
          ref={ref}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            width="100%"
            columnGap={1}
          >
            {/* LEFT ICON */}
            {icon && (
              <Icon
                component={type === 'entity' ? getEntityIcon() : getIcon(icon)}
                sx={{ height: 18, width: 18, color }}
              />
            )}

            {/* LABEL */}
            <Stack sx={{ flexGrow: 1 }}>
              <Typography variant="body2">{displayName}</Typography>
              {description && (
                <Typography color="text.secondary" variant="caption">
                  {description}
                </Typography>
              )}
            </Stack>

            {/* RIGHT ICON: PROGRESS / NONE / ARROW  */}
            {hasChildrenItems &&
              (isLoadingChildren ? (
                <CircularProgress size={16} thickness={5} />
              ) : children.length === 0 ? (
                <BlockIcon color="error" sx={{ fontSize: 16 }} />
              ) : (
                <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
              ))}
          </Stack>
        </MenuItem>

        {/* CHILDREN */}
        {
          // hasChildrenItems &&
          (children.length > 0 || isLoadingChildren) && showChildren && (
            <NestedMenu
              anchorEl={anchorEl}
              childrenItems={children}
              collectionType={collectionType}
              isLoading={isLoadingChildren}
            />
          )
        }
      </>
    );
  }
);
