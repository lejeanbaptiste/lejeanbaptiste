import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createOvermind } from 'overmind';
import { Provider } from 'overmind-react';
import type { ReactElement } from 'react';
import { config } from '../src/overmind';
import theme from '../src/theme';

/**
 * Renders a component inside a real Overmind instance and this package's own
 * MUI theme — the two providers essentially every component here assumes.
 *
 * Using the real config and theme rather than stubs means the test exercises the
 * actual state shape and palette, so it keeps working as those change, and a
 * component that mounts here is one that would mount in the app. Components
 * reading `theme.vars.*` need the CSS-variables theme specifically; MUI's
 * implicit default has no `vars` and those reads throw with "Cannot read
 * properties of undefined (reading 'palette')".
 *
 * Note this only became usable once `overmind/validator/devWorkerUrl` was split
 * out: the overmind config transitively pulled in `import.meta`, which ts-jest
 * cannot compile, so importing the config at all was a parse error.
 */
export const renderWithOvermind = (ui: ReactElement) => {
  const overmind = createOvermind(config, { devtools: false });
  return render(
    <Provider value={overmind}>
      {/* Mirrors src/Providers.tsx: the mode has to be pinned, or components
          reading `theme.vars.*` in `sx` callbacks get a theme without `vars`. */}
      <ThemeProvider theme={theme} defaultMode="light" storageManager={null}>
        {ui}
      </ThemeProvider>
    </Provider>,
  );
};
