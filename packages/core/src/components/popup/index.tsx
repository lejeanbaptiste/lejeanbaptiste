import React, { FC } from 'react';
import { Link, Popover, Typography } from '@mui/material';
import { useAppState } from '@src/overmind';

export interface PopupProps {
  content?: string;
  id?: string;
  isLink?: boolean;
  open: boolean;
  position?: {
    left: number;
    top: number;
  };
}

const Popup: FC = (props) => {
  const { popupProps } = useAppState().ui;
  const { content, id, isLink, open, position } = popupProps;
  const { left, top } = position ?? { left: 0, top: 0 };

  const handlePopoverClose = () => {};

  return (
    <Popover
      anchorReference="anchorPosition"
      anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      anchorPosition={{ left, top }}
      disableRestoreFocus
      id="popup"
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

export default Popup;
