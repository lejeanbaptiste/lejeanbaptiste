import { render } from '@testing-library/react';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import type { ReactElement } from 'react';
import { config } from '../src/overmind';

/**
 * Renders a component inside a real Overmind instance.
 *
 * Components in this package read state through `useAppState`/`useActions`,
 * which throw without a Provider above them. Using the real config rather than
 * stubbing the hooks means the test exercises the actual state shape, so it
 * keeps working as slices change — and a component that mounts here is one that
 * would mount in the app.
 *
 * Note this only became usable once `overmind/validator/devWorkerUrl` was split
 * out: the overmind config transitively pulled in `import.meta`, which ts-jest
 * cannot compile, so importing the config at all was a parse error.
 */
export const renderWithOvermind = (ui: ReactElement) => {
  const overmind = createOvermind(config, { devtools: false });
  return render(<Provider value={overmind}>{ui}</Provider>);
};
