'use client';

import { Provider, getDefaultStore } from 'jotai';
import { DevTools } from 'jotai-devtools';
import 'jotai-devtools/styles.css';

const defaultJotaiStore = getDefaultStore();

const isDesktopElectronApp = () =>
  typeof window !== 'undefined' &&
  !!(window as Window & { electronAPI?: unknown }).electronAPI;

export const JotaiProvider = ({ children }: React.PropsWithChildren) => {
  const showJotaiDevTools =
    process.env.NODE_ENV === 'development' && !isDesktopElectronApp();

  return (
    <Provider store={defaultJotaiStore}>
      {children}
      {showJotaiDevTools ? <DevTools position="bottom-right" theme="dark" /> : null}
    </Provider>
  );
};
