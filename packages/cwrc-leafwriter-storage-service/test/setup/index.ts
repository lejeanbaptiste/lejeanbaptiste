// ! Configuring Your Testing Environment
// https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html
//@ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import '@testing-library/jest-dom';
import '@testing-library/jest-dom/jest-globals';
import { useRef } from 'react';
import { jest } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
Object.defineProperty(window, 'scrollTo', { value: noop, writable: true });

// `Header`'s `useAnimate` (motion/react) plays a real, timed animation
// before updating its title text. jsdom has no compositor, so the
// animation still runs against real timers - under CI/worker load its
// completion can occasionally take longer than a `waitFor`'s default
// timeout, causing intermittent failures on assertions like
// `getByText(header, preferProvider)` that have nothing to do with the
// animation itself. Stub `useAnimate` so `animate()` resolves immediately;
// every other `motion/react` export (declarative `motion.div`,
// `AnimatePresence`, etc.) stays real since those don't block on await.
jest.mock('motion/react', () => {
  const actual = jest.requireActual('motion/react') as object;
  return {
    ...actual,
    useAnimate: () => {
      const scope = useRef(null);
      const animate = async () => {};
      return [scope, animate];
    },
  };
});
