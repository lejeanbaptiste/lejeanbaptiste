import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import type { PluginToolbarMenuItem } from '../../plugins/pluginExtensions';
import theme from '../../theme';

// `../../icons` transitively imports overmind -> nanoid (ESM-only), which
// jest's default transform can't parse. That chain is irrelevant to what
// this test verifies (menu open/close/click wiring), so stub it out rather
// than pulling in real icon rendering.
jest.mock('../../icons', () => ({ getIcon: () => 'svg' }));

import { MenuButton } from './MenuButton';

const render: typeof rtlRender = (ui, options) =>
  rtlRender(<ThemeProvider theme={theme}>{ui}</ThemeProvider>, options);

describe('MenuButton', () => {
  const menuItems: PluginToolbarMenuItem[] = [
    { id: 'a', label: 'Tag noble title', onClick: jest.fn() },
    { id: 'b', label: 'Disabled action', onClick: jest.fn(), disabled: true },
  ];

  it('is closed until clicked, then lists every menu item', async () => {
    const user = userEvent.setup();
    render(
      <MenuButton
        icon="date"
        title="Norbert"
        type="menuButton"
        group="ui"
        menuItems={menuItems}
        openCalendar={() => undefined}
      />,
    );
    expect(screen.queryByText('Tag noble title')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Norbert' }));

    expect(screen.getByText('Tag noble title')).not.toBeNull();
    expect(screen.getByText('Disabled action').closest('li')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it("calls the clicked item's onClick with openCalendar, and closes the menu", async () => {
    const user = userEvent.setup();
    const openCalendar = jest.fn();
    render(
      <MenuButton
        icon="date"
        title="Norbert"
        type="menuButton"
        group="ui"
        menuItems={menuItems}
        openCalendar={openCalendar}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Norbert' }));
    await user.click(screen.getByText('Tag noble title'));

    expect(menuItems[0]!.onClick).toHaveBeenCalledWith({ openCalendar });
    expect(screen.queryByText('Tag noble title')).toBeNull();
  });

  it('renders a disabled item as unclickable (aria-disabled + pointer-events: none)', async () => {
    const user = userEvent.setup();
    render(
      <MenuButton
        icon="date"
        title="Norbert"
        type="menuButton"
        group="ui"
        menuItems={menuItems}
        openCalendar={() => undefined}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Norbert' }));

    const disabledItem = screen.getByText('Disabled action').closest('li')!;
    expect(disabledItem.getAttribute('aria-disabled')).toBe('true');
    // MUI backs disabled state with pointer-events:none, which is exactly why
    // a synthetic click on it never reaches onClick — verified structurally
    // rather than by attempting the (blocked) click itself.
    expect(getComputedStyle(disabledItem).pointerEvents).toBe('none');
    expect(menuItems[1]!.onClick).not.toHaveBeenCalled();
  });
});
