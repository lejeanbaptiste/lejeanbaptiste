import { render } from '@testing-library/react';
import { forwardRef, type ReactNode } from 'react';
import { DateCuratorPanel } from './DateCuratorPanel';

/**
 * Render smoke test for the date curator panel. See
 * apps/commons/src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why
 * these exist: mounting is what evaluates hook bodies and dependency arrays.
 *
 * The empty-suggestions case is the point — it exercises the whole hook chain
 * without depending on how any individual row renders.
 */

jest.mock('react-virtuoso', () => ({
  Virtuoso: forwardRef(function MockVirtuoso(
    {
      data,
      itemContent,
    }: { data?: unknown[]; itemContent?: (i: number, row: unknown) => ReactNode },
    _ref,
  ) {
    return <div>{(data ?? []).map((row, i) => itemContent?.(i, row))}</div>;
  }),
}));

describe('DateCuratorPanel', () => {
  it('mounts with no suggestions', () => {
    expect(() => render(<DateCuratorPanel suggestions={[]} onApply={jest.fn()} />)).not.toThrow();
  });

  it('mounts while busy', () => {
    expect(() =>
      render(<DateCuratorPanel suggestions={[]} onApply={jest.fn()} busy />),
    ).not.toThrow();
  });
});
