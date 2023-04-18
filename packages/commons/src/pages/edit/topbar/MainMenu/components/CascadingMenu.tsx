import { MenuProps } from '@mui/material';
import HoverMenu from 'material-ui-popup-state/HoverMenu';
import { bindMenu, usePopupState } from 'material-ui-popup-state/hooks';
import React, { useContext, useMemo } from 'react';
import { CascadingContext } from '..';
import { useMenu } from '../useMenu';

export interface CascadingMenuProps extends Omit<MenuProps, 'open'> {
  popupState: ReturnType<typeof usePopupState>;
}

export const CascadingMenu = ({ popupState, ...props }: CascadingMenuProps) => {
  const { MIN_WIDTH } = useMenu();

  const { rootPopupState } = useContext(CascadingContext);

  const context = useMemo(
    () => ({
      rootPopupState: rootPopupState || popupState,
      parentPopupState: popupState,
    }),
    [rootPopupState?.anchorEl, popupState.anchorEl]
  );

  return (
    <CascadingContext.Provider value={context}>
      <HoverMenu
        MenuListProps={{ dense: true, sx: { minWidth: MIN_WIDTH, py: 0.5, borderRadius: 1 } }}
        {...props}
        {...bindMenu(popupState)}
      />
    </CascadingContext.Provider>
  );
};
