import { Box, ListItem, ListItemButton, PaletteMode, Typography, useTheme } from '@mui/material';
import React, { useMemo, type HTMLAttributes, type MouseEvent } from 'react';
import { ExpandButton } from './ExpandButton';

interface Props extends Omit<HTMLAttributes<HTMLLIElement>, 'id'> {
  childCount?: number;
  content: string;
  expanded?: boolean;
  depth: number;
  disableInteraction?: boolean;
  disableSelection?: boolean;
  expandDisabled?: boolean;
  handleProps?: any;
  indentationWidth: number;
  label: string;
  nodeId: string;
  onExpand?(): void;
  onSelectItem?: (id: string) => void;
  selected?: boolean;
  wrapperRef?(node: HTMLLIElement): void;
}

export const Item = ({
  content,
  depth,
  childCount,
  disableInteraction,
  disableSelection,
  expanded,
  expandDisabled,
  handleProps,
  indentationWidth,
  label,
  nodeId,
  onExpand,
  onSelectItem,
  selected,
  wrapperRef,
  ...props
}: Props) => {
  const { palette } = useTheme();

  const inverseThemeMode: PaletteMode = useMemo(
    () => (palette.mode === 'light' ? 'dark' : 'light'),
    [palette.mode]
  );

  const hanldeSelectItem = () => onSelectItem && onSelectItem(nodeId);

  const handleExpand = (event: MouseEvent<HTMLElement, globalThis.MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();
    if (expandDisabled) return;
    onExpand && onExpand();
  };

  return (
    <ListItem
      ref={wrapperRef}
      {...props}
      disableGutters
      disablePadding
      dense
      sx={{ mb: '1px', pl: `${indentationWidth * depth}px` }}
    >
      <ListItemButton
        selected={selected}
        onClick={hanldeSelectItem}
        sx={{ borderRadius: 1, px: 1, gap: 0.5 }}
      >
        {onExpand ? (
          <ExpandButton
            disabled={expandDisabled}
            onClick={handleExpand}
            {...{ expanded, selected }}
          />
        ) : (
          <Box width={18} height={18} />
        )}
        <Typography
          color={selected ? palette.primary[inverseThemeMode] : 'inherit'}
          fontWeight={selected ? 700 : 500}
          sx={{
            display: '-webkit-box',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            WebkitLineClamp: 3,
            lineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
          variant="subtitle2"
        >
          {content}
        </Typography>
      </ListItemButton>
    </ListItem>
  );
};
