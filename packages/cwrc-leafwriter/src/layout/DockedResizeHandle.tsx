import Box from '@mui/material/Box';
import { useCallback, useRef, useState } from 'react';

const MIN_WIDTH = 260;
const MAX_WIDTH = 900;

const clampWidth = (width: number) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));

/**
 * Panel width with a localStorage-persisted override. `update` clamps to a
 * sane docked range; pass `persist` on drag end so mid-drag values are not
 * written on every pointer move.
 */
export function useStoredPanelWidth(storageKey: string, defaultWidth: number) {
  const [width, setWidth] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem(storageKey));
      if (Number.isFinite(stored) && stored > 0) return clampWidth(stored);
    } catch {
      // storage unavailable — fall through to the default
    }
    return defaultWidth;
  });

  const update = useCallback(
    (next: number, persist = false) => {
      const clamped = clampWidth(next);
      setWidth(clamped);
      if (persist) {
        try {
          window.localStorage.setItem(storageKey, String(clamped));
        } catch {
          // storage unavailable — width just won't survive a restart
        }
      }
      return clamped;
    },
    [storageKey],
  );

  return [width, update] as const;
}

interface DockedResizeHandleProps {
  width: number;
  onResize: (width: number, persist?: boolean) => void;
}

/**
 * Invisible full-height drag strip over a docked panel's left edge. The
 * parent must be `position: relative`; dragging left widens the panel.
 */
export const DockedResizeHandle = ({ width, onResize }: DockedResizeHandleProps) => {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  return (
    <Box
      data-testid="docked-resize-handle"
      onPointerDown={(event) => {
        drag.current = { startX: event.clientX, startWidth: width };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onResize(drag.current.startWidth + (drag.current.startX - event.clientX));
      }}
      onPointerUp={(event) => {
        if (!drag.current) return;
        onResize(drag.current.startWidth + (drag.current.startX - event.clientX), true);
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      sx={{
        position: 'absolute',
        left: -3,
        top: 0,
        bottom: 0,
        width: 8,
        cursor: 'col-resize',
        zIndex: (theme) => theme.zIndex.appBar,
        touchAction: 'none',
        '&:hover, &:active': {
          bgcolor: 'primary.main',
          opacity: 0.25,
        },
      }}
    />
  );
};
