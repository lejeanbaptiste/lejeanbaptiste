import { useEffect, useState } from 'react';
import { useDebounce, useKey } from 'react-use';

export const useKeyboardShortcut = () => {
  const [val, setVal] = useState('');
  const [shortcut, setShortcut] = useState<string>('');

  const reset = () => {
    setShortcut('');
    setVal('');
  };

  useDebounce(() => setShortcut(val), 2000, [val]);

  useEffect(() => {
    if (shortcut !== '') reset();
  }, [shortcut]);

  const shorcutEventAction = (event: KeyboardEvent, combo: string) => {
    event.stopPropagation();
    event.preventDefault();
    if (event.repeat) return;
    setVal(combo);
  };

  useKey(
    (event: KeyboardEvent) => event.metaKey && event.key.toLowerCase() === 's',
    (event) => shorcutEventAction(event, '⌘S'),
    { event: 'keydown' },
  );

  useKey(
    (event: KeyboardEvent) =>
      // With Alt held, macOS reports a transformed character in `key`, so keep a
      // physical-key fallback for this combo only.
      event.metaKey &&
      event.altKey &&
      event.shiftKey &&
      (event.key.toLowerCase() === 's' || event.code === 'KeyS'),
    (event) => shorcutEventAction(event, '⌘⌥⇧S'),
    { event: 'keydown' },
  );

  useKey(
    (event: KeyboardEvent) => event.metaKey && event.key.toLowerCase() === 'o',
    (event) => shorcutEventAction(event, '⌘O'),
    { event: 'keydown' },
  );

  return { shortcut };
};
