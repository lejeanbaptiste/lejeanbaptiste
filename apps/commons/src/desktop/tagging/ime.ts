/**
 * True while an IME (e.g. Chinese/Japanese/Korean) is composing, or for the
 * keydown that browsers fire with keyCode 229 during composition.
 * Prefer this over only checking `isComposing` so Esc/Enter are not stolen
 * from the IME on the first cancel/confirm keystroke.
 */
export const isImeKeyboardEvent = (event: {
  isComposing?: boolean;
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
}): boolean => {
  const native = event.nativeEvent ?? event;
  return Boolean(native.isComposing || native.keyCode === 229);
};
