'use client';

import { Provider, getDefaultStore } from 'jotai';
import { Suspense, lazy, type PropsWithChildren } from 'react';

const defaultJotaiStore = getDefaultStore();
const JotaiDevTools =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('./jotai-devtools-panel'))
    : null;

const isDesktopElectronApp = () =>
  typeof window !== 'undefined' &&
  !!(window as Window & { electronAPI?: unknown }).electronAPI;

export const JotaiProvider = ({ children }: PropsWithChildren) => {
  const showJotaiDevTools =
    process.env.NODE_ENV === 'development' && !isDesktopElectronApp();

  return (
    <Provider store={defaultJotaiStore}>
      {children}
      {showJotaiDevTools && JotaiDevTools ? (
        <Suspense fallback={null}>
          <JotaiDevTools />
        </Suspense>
      ) : null}
    </Provider>
  );
};
