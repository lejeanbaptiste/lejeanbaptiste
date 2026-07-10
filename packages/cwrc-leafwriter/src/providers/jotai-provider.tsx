'use client';

import { Provider, getDefaultStore } from 'jotai';
import type { PropsWithChildren } from 'react';

const defaultJotaiStore = getDefaultStore();

export const JotaiProvider = ({ children }: PropsWithChildren) => (
  <Provider store={defaultJotaiStore}>{children}</Provider>
);
