import { isImeKeyboardEvent } from './ime';

describe('isImeKeyboardEvent', () => {
  it('detects composing events and keyCode 229', () => {
    expect(isImeKeyboardEvent({ isComposing: true })).toBe(true);
    expect(isImeKeyboardEvent({ keyCode: 229 })).toBe(true);
    expect(isImeKeyboardEvent({ isComposing: false, keyCode: 27 })).toBe(false);
    expect(
      isImeKeyboardEvent({
        isComposing: false,
        nativeEvent: { isComposing: true, keyCode: 229 },
      }),
    ).toBe(true);
  });
});
