import { useKey, useDebounce } from 'react-use';
import { useState, useEffect } from 'react';

export const useKeyboardShortcut = () => {
  const [val, setVal] = useState('');
  const [shortcut, setShortcut] = useState<string>('');

  const reset = () => {
    setShortcut('');
    setVal('');
  }

  const [, cancel] = useDebounce(() => setShortcut(val), 2000, [val]);

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
    (event: KeyboardEvent) => event.metaKey && event.code === 'KeyS',
    (event) => shorcutEventAction(event, '⌘S'),
    { event: 'keydown' }
  );

  useKey(
    (event: KeyboardEvent) =>
      event.metaKey && event.altKey && event.shiftKey && event.code === 'KeyS',
    (event) => shorcutEventAction(event, '⌘⌥⇧S'),
    { event: 'keydown' }
  );

  useKey(
    (event: KeyboardEvent) => event.metaKey && event.code === 'KeyO',
    (event) => shorcutEventAction(event, '⌘O'),
    { event: 'keydown' }
  );

  return { shortcut };
};
