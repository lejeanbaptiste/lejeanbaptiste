'use client';

import { Provider, getDefaultStore } from 'jotai';
import { DevTools } from 'jotai-devtools';
import 'jotai-devtools/styles.css';

const defaultJotaiStore = getDefaultStore();

export const JotaiProvider = ({ children }: React.PropsWithChildren) => {
  return (
    <Provider store={defaultJotaiStore}>
      {children}
      <DevTools position="bottom-right" theme="dark" />
    </Provider>
  );
};
