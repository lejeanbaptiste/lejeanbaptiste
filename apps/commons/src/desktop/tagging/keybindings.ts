export const DEFAULT_INSERT_TAG = 'p';
export const DEFAULT_LINE_BREAK_TAG = 'lb';

export const matchesTagPopupOpen = (event: KeyboardEvent): boolean =>
  event.code === 'Enter' || event.code === 'NumpadEnter';

export const matchesTagPopupPropagate = (event: KeyboardEvent): boolean =>
  (event.code === 'Enter' || event.code === 'NumpadEnter') && event.shiftKey;

export const matchesTagPopupQueueWalk = (event: KeyboardEvent): boolean =>
  (event.code === 'Enter' || event.code === 'NumpadEnter') && event.altKey;

export const matchesEditorTagPopup = (event: KeyboardEvent): boolean =>
  (event.code === 'Enter' || event.code === 'NumpadEnter') && !event.shiftKey && !event.altKey;

export const matchesEditorLineBreak = (event: KeyboardEvent): boolean =>
  (event.code === 'Enter' || event.code === 'NumpadEnter') && event.shiftKey;

export const matchesEditorRename = (event: KeyboardEvent): boolean => event.code === 'F2';

export const matchesWalkModeTag = (event: KeyboardEvent): boolean =>
  (event.code === 'Enter' || event.code === 'NumpadEnter') && !event.shiftKey && !event.altKey;

export const matchesWalkModeSkip = (event: KeyboardEvent): boolean => event.code === 'Tab' && !event.shiftKey;
