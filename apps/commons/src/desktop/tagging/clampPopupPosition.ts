import { useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from 'react';

export const POPUP_ANCHOR_GAP = 8;
export const POPUP_VIEWPORT_PADDING = 8;

export interface ClampFixedPopupPositionInput {
  /** Caret anchor — used when flipping above the selection. */
  anchorTop: number;
  anchorGap?: number;
  height: number;
  padding?: number;
  preferredLeft: number;
  preferredTop: number;
  width: number;
}

/** Keep a fixed-position popup fully inside the viewport, flipping above the
 * anchor when there isn't room below. */
export const clampFixedPopupPosition = ({
  anchorGap = POPUP_ANCHOR_GAP,
  anchorTop,
  height,
  padding = POPUP_VIEWPORT_PADDING,
  preferredLeft,
  preferredTop,
  width,
}: ClampFixedPopupPositionInput): { left: number; top: number } => {
  const maxLeft = Math.max(padding, window.innerWidth - width - padding);
  const maxTop = Math.max(padding, window.innerHeight - height - padding);

  const left = Math.min(Math.max(preferredLeft, padding), maxLeft);

  let top = preferredTop;
  if (top + height > window.innerHeight - padding) {
    const aboveTop = anchorTop - height - anchorGap;
    top = aboveTop >= padding ? aboveTop : maxTop;
  }
  top = Math.min(Math.max(top, padding), maxTop);

  return { left, top };
};

/** Measure a popup after layout and clamp it to the viewport. */
export const useClampedPopupPosition = (
  anchor: { left: number; top: number } | null,
  open: boolean,
  layoutDeps: DependencyList = [],
): { left: number; ref: RefObject<HTMLDivElement>; top: number } => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) return;

    const update = () => {
      if (!ref.current || !anchor) return;
      const { width, height } = ref.current.getBoundingClientRect();
      setPosition(
        clampFixedPopupPosition({
          anchorTop: anchor.top,
          height,
          preferredLeft: anchor.left,
          preferredTop: anchor.top + POPUP_ANCHOR_GAP,
          width,
        }),
      );
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutDeps are caller-provided size hints
  }, [open, anchor?.left, anchor?.top, ...layoutDeps]);

  return {
    ref,
    left: position.left,
    top: position.top,
  };
};
