import { Link, Popover, Typography } from '@mui/material';
import React from 'react';
import { useAppState } from '../../overmind';
import { IDialog } from '../type';

export interface PopupProps extends IDialog {
  content?: string;
  id?: string;
  isLink?: boolean;
  open?: boolean;
  position?: {
    left: number;
    top: number;
  };
}

export const Popup = ({ content, id, isLink, onClose, open = false, position }: PopupProps) => {
  const { settings } = useAppState().editor;
  // const { popupProps } = useAppState().ui;

  // const { content, id, isLink, open, position } = popupProps;
  const { left, top } = position ?? { left: 0, top: 0 };

  const handlePopoverClose = () => onClose && onClose(id);

  return (
    <Popover
      anchorReference="anchorPosition"
      anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      anchorPosition={{ left, top }}
      container={document.getElementById(`${settings?.container}`)}
      disableRestoreFocus
      id={id}
      onClose={handlePopoverClose}
      open={open}
      transformOrigin={{ horizontal: 'left', vertical: 'top' }}
      sx={{ pointerEvents: 'none' }}
    >
      <Typography sx={{ p: 1 }} variant="body2">
        {isLink ? (
          <Link href={content} rel="noreferrer" target="_blank">
            {content}
          </Link>
        ) : (
          content
        )}
      </Typography>
    </Popover>
  );
};
