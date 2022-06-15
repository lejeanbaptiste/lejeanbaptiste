import { useKey } from 'react-use';

export const useKeyboardShortcut = () => {
  
  const shorcutEventAction = (event: KeyboardEvent, combo: string) => {
    event.stopPropagation();
    event.preventDefault();
    if (event.repeat) return;
    if (combo === '⌘O') return console.log(combo);
    if (combo === '⌘S') return console.log(combo);
    if (combo === '⌘⌥⇧S') return console.log(combo);
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
};
