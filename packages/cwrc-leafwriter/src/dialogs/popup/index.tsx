import { Paper, Popper } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useActions, useAppState } from '../../overmind';
import { EntityType } from '../../types';
import { IDialog } from '../type';
import { Content } from './Content';

export interface PopupProps extends IDialog {
  closeOnMouseOutTarget?: boolean;
  content?: string;
  entityType?: EntityType;
  id?: string;
  isLink?: boolean;
  open?: boolean;
  position?: { left: number; top: number };
}

export const Popup = (props: PopupProps) => {
  const { content, entityType, id, isLink, onClose, open = false } = props;

  const { settings } = useAppState().editor;
  const { closeDialog, editDialogPopupProps } = useActions().ui;

  const [anchorEl, setAnchorEl] = useState<Element | null>(null);
  const [offset, setOffset] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useEffect(() => {
    getAnchor();
    getOffset();
  }, []);

  const getAnchor = useCallback(() => {
    const element = window.writer.editor?.getBody().querySelector(`#${id}`);
    if (!element) return;

    setAnchorEl(element);
  }, []);

  const getOffset = useCallback(() => {
    const editorRect = window.writer.editor?.editorContainer.getBoundingClientRect();
    const position = { left: editorRect?.left || 0, top: editorRect?.top || 0 };
    setOffset(position);
  }, []);

  const handleMouseEnter = () => {
    editDialogPopupProps({ ...props, closeOnMouseOutTarget: false });
  };

  const handleMouseLeave = () => close();

  const close = () => {
    if (id) closeDialog(id);
    onClose && onClose(id);
  };

  return (
    <>
      {!!anchorEl && (
        <Popper
          anchorEl={anchorEl}
          container={document.getElementById(`${settings?.container}`)}
          id={id}
          open={open}
          placement="bottom"
          disablePortal={false}
          modifiers={[
            {
              name: 'flip',
              enabled: true,
              options: { altBoundary: true, rootBoundary: 'viewport', padding: 8 },
            },
            {
              name: 'preventOverflow',
              enabled: true,
              options: {
                altAxis: true,
                altBoundary: true,
                tether: true,
                rootBoundary: 'viewport',
                padding: 8,
              },
            },
          ]}
        >
          <Paper
            sx={{
              boxShadow:
                '0px 0px 2px 0px rgba(0,0,0,0.2), 0px 0px 9px 0px rgba(0,0,0,0.14), 0px 0px 2px 0px rgba(0,0,0,0.12)',
              transform: `translate3d(${offset?.left}px, ${offset?.top}px, 0px) !important`,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <Content {...{ content, entityType, isLink }} />
          </Paper>
        </Popper>
      )}
    </>
  );
};
