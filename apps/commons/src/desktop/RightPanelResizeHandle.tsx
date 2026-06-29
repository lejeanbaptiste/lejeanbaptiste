import { Box } from '@mui/material';
import { useCallback, useRef } from 'react';

interface RightPanelResizeHandleProps {
  panelWidth: number;
  onWidthChange: (width: number) => void;
}

export const RightPanelResizeHandle = ({
  panelWidth,
  onWidthChange,
}: RightPanelResizeHandleProps) => {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(panelWidth);

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      draggingRef.current = true;
      startXRef.current = event.clientX;
      startWidthRef.current = panelWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!draggingRef.current) return;
        // Dragging left (negative delta) increases width for a right panel
        onWidthChange(startWidthRef.current - (moveEvent.clientX - startXRef.current));
      };

      const onMouseUp = () => {
        draggingRef.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [onWidthChange, panelWidth],
  );

  return (
    <Box
      aria-label="Resize right panel"
      onMouseDown={onMouseDown}
      sx={{
        position: 'absolute',
        top: 0,
        left: -3,
        width: 6,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 2,
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    />
  );
};
