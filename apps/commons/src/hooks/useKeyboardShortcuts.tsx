import { useEffect, useState } from 'react';
import { useDebounce, useKey } from 'react-use';
import { isMacOS, modShortcut } from '@src/utils/platform';

export const useKeyboardShortcut = () => {
  const [val, setVal] = useState('');
  const [shortcut, setShortcut] = useState<string>('');
  const mac = isMacOS();

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

  const isMod = (event: KeyboardEvent) => (mac ? event.metaKey : event.ctrlKey);

  useKey(
    (event: KeyboardEvent) => isMod(event) && event.key.toLowerCase() === 's',
    (event) => shorcutEventAction(event, modShortcut('S')),
    { event: 'keydown' },
    [mac],
  );

  useKey(
    (event: KeyboardEvent) =>
      // With Alt held, macOS reports a transformed character in `key`, so keep a
      // physical-key fallback for this combo only.
      isMod(event) &&
      event.altKey &&
      event.shiftKey &&
      (event.key.toLowerCase() === 's' || event.code === 'KeyS'),
    (event) => shorcutEventAction(event, mac ? '⌘⌥⇧S' : 'Ctrl+Alt+Shift+S'),
    { event: 'keydown' },
    [mac],
  );

  useKey(
    (event: KeyboardEvent) => isMod(event) && event.key.toLowerCase() === 'o',
    (event) => shorcutEventAction(event, modShortcut('O')),
    { event: 'keydown' },
    [mac],
  );

  return { shortcut };
};
