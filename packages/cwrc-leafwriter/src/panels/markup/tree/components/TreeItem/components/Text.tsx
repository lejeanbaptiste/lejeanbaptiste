import TagRoundedIcon from '@mui/icons-material/TagRounded';
import { ListItemButton, useTheme } from '@mui/material';
import chroma from 'chroma-js';
import classNames from 'classnames';
import { HTMLAttributes, MouseEvent, forwardRef, useMemo, useState } from 'react';
import { useItem } from '../useItem';
import { Icon, ItemProps, Label } from './';

export interface TextProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'id'>, ItemProps {}

export const Text = forwardRef<HTMLDivElement, TextProps>(
  (
    {
      canAddToMultiselection,
      classnames,
      content,
      handleProps,
      label,
      nodeId,
      onContextMenuOpen,
      onSelectItem,
      selected,
      style,
    },
    ref,
  ) => {
    const theme = useTheme();

    const cleanedContent = useMemo(() => {
      // * Ignore tab and line-breaks
      const trimmedContent = content?.replaceAll(/\\n|\\t|\\r/g, '').trim();
      if (trimmedContent === '') return '[white spaces]';
      return trimmedContent;
    }, [content]);

    const { setHover, details } = useItem({ content: cleanedContent, id: nodeId, selected });

    const [multiselectable, setMultiselectable] = useState(true);

    const hanldeSelectItem = (event: MouseEvent<HTMLElement, Event>) => {
      if (!multiselectable) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onSelectItem && onSelectItem(event, { id: nodeId });
    };

    const handleContextMenu = (event: MouseEvent<HTMLElement, globalThis.MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();

      onContextMenuOpen && onContextMenuOpen(event, { id: nodeId });
    };

    const handleMouseOver = (event: MouseEvent<HTMLAnchorElement, globalThis.MouseEvent>) => {
      setHover(true);
      if (event.shiftKey && canAddToMultiselection)
        setMultiselectable(canAddToMultiselection(nodeId));
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
          '&.Mui-selected': {
            backgroundColor: chroma(theme.palette.primary[theme.palette.mode])
              .alpha(theme.palette.action.selectedOpacity)
              .css(),
            '&:hover': {
              backgroundColor: chroma(theme.palette.primary[theme.palette.mode])
                .alpha(theme.palette.action.hoverOpacity + theme.palette.action.selectedOpacity)
                .css(),
            },
          },
        }}
      >
        <Icon icon={TagRoundedIcon} />
        <Label details={details} selected={selected} sx={{ opacity: 0.6 }}>
          {label}
        </Label>
      </ListItemButton>
    );
  },
);
