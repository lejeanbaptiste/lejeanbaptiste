import { clampFixedPopupPosition, POPUP_ANCHOR_GAP, POPUP_VIEWPORT_PADDING } from './clampPopupPosition';

describe('clampFixedPopupPosition', () => {
  const viewport = { width: 800, height: 600 };

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: viewport.width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewport.height });
  });

  it('keeps the popup below the anchor when there is room', () => {
    expect(
      clampFixedPopupPosition({
        anchorTop: 100,
        height: 200,
        preferredLeft: 120,
        preferredTop: 108,
        width: 260,
      }),
    ).toEqual({ left: 120, top: 108 });
  });

  it('shifts left when the popup would overflow the right edge', () => {
    expect(
      clampFixedPopupPosition({
        anchorTop: 100,
        height: 200,
        preferredLeft: 700,
        preferredTop: 108,
        width: 260,
      }),
    ).toEqual({
      left: viewport.width - 260 - POPUP_VIEWPORT_PADDING,
      top: 108,
    });
  });

  it('flips above the anchor when there is not enough room below', () => {
    expect(
      clampFixedPopupPosition({
        anchorTop: 500,
        height: 200,
        preferredLeft: 120,
        preferredTop: 508,
        width: 260,
      }),
    ).toEqual({
      left: 120,
      top: 500 - 200 - POPUP_ANCHOR_GAP,
    });
  });

  it('pins to the top padding when the popup is taller than the viewport', () => {
    expect(
      clampFixedPopupPosition({
        anchorTop: 500,
        height: 700,
        preferredLeft: 120,
        preferredTop: 508,
        width: 260,
      }),
    ).toEqual({
      left: 120,
      top: POPUP_VIEWPORT_PADDING,
    });
  });
});
