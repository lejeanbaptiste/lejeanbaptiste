import crypto from 'crypto';
import { enableFetchMocks } from 'jest-fetch-mock';
import { TextDecoder, TextEncoder } from 'util';

enableFetchMocks();

Object.assign(global, { TextDecoder, TextEncoder });

Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: {
      digest: (algorithm: string, data: Uint8Array) => {
        return new Promise((resolve) =>
          resolve(crypto.createHash(algorithm).update(data).digest()),
        );
      },
    },
  },
});

// jsdom implements neither of these, and both are touched by any component that
// renders MUI responsive styles or observes its own container. Stubbed here so
// render tests do not each have to repeat it.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
